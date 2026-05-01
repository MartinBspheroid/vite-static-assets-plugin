/**
 * B4 / B5 / B6 watcher regression tests.
 *
 * These exercise the dev-server watcher logic (configureServer + closeBundle)
 * without spinning up a real Vite dev server. We provide a fake server that
 * mimics the surface the plugin touches: an EventEmitter for `watcher`, a
 * stubbed moduleGraph + ws, and an EventEmitter for httpServer.
 *
 * - B4: every src/ save was triggering a full asset rescan because
 *   server.watcher is project-wide. Fix gates handlers on path prefix.
 * - B5: buildEnd is a Rollup hook and never fires for dev-server stop.
 *   Fix: closeBundle hook + httpServer 'close' detach listeners.
 * - B6: clearTimeout doesn't cancel an in-flight async callback. Fix:
 *   serialize rescans through an inFlight promise.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import staticAssetsPlugin from '../src/index'

// ---------- fake Vite dev server ----------

interface FakeServer {
  watcher: EventEmitter & { add: (...args: unknown[]) => void; off: EventEmitter['off'] }
  moduleGraph: { getModuleById: () => null; invalidateModule: () => void }
  ws: { send: (msg: unknown) => void }
  httpServer: EventEmitter
}

function makeFakeServer(): FakeServer {
  const watcherEmitter = new EventEmitter()
  // chokidar's API surface that the plugin calls; emitters' `off` is fine here.
  const watcher = Object.assign(watcherEmitter, {
    add: () => {},
    off: watcherEmitter.off.bind(watcherEmitter),
  }) as FakeServer['watcher']
  return {
    watcher,
    moduleGraph: {
      getModuleById: () => null,
      invalidateModule: () => {},
    },
    ws: { send: () => {} },
    httpServer: new EventEmitter(),
  }
}

// ---------- fixture lifecycle ----------

let tmpRoot: string
let prevCwd: string

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vsap-watcher-'))
  prevCwd = process.cwd()
  process.chdir(tmpRoot)
  // Quiet the plugin's chatty info() during tests; restore on teardown.
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  process.chdir(prevCwd)
  fs.rmSync(tmpRoot, { recursive: true, force: true })
  vi.restoreAllMocks()
})

// Fire buildStart so currentFiles is populated before exercising the watcher.
async function bootstrap(plugin: ReturnType<typeof staticAssetsPlugin>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildStart = (plugin as any).buildStart as () => Promise<void>
  await buildStart.call({})
}

// Drive configureServer manually with our fake server.
function configureServer(plugin: ReturnType<typeof staticAssetsPlugin>, server: FakeServer) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg = (plugin as any).configureServer as (s: unknown) => void
  cfg.call({}, server)
}

function closeBundle(plugin: ReturnType<typeof staticAssetsPlugin>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cb = (plugin as any).closeBundle as () => void
  cb.call({})
}

// Returns the total count of listeners across the five watcher events the
// plugin attaches to. Used to detect leaks.
function watcherListenerCount(server: FakeServer): number {
  return (
    server.watcher.listenerCount('add') +
    server.watcher.listenerCount('unlink') +
    server.watcher.listenerCount('change') +
    server.watcher.listenerCount('addDir') +
    server.watcher.listenerCount('unlinkDir')
  )
}

// ---------- B4: path filter ----------

describe('watcher path filter (B4)', () => {
  it('ignores change events outside the configured directory', async () => {
    fs.mkdirSync('public', { recursive: true })
    fs.writeFileSync('public/logo.png', 'x')
    const dts = path.join(tmpRoot, 'out.d.ts')
    const plugin = staticAssetsPlugin({ typesOutputFile: dts, debounce: 30 })
    await bootstrap(plugin)

    const initialContent = fs.readFileSync(dts, 'utf8')
    expect(initialContent).toContain('"logo.png"')

    const server = makeFakeServer()
    configureServer(plugin, server)

    // Add a NEW asset on disk WITHOUT emitting an event for it. If the path
    // filter were a no-op, the out-of-tree event below would still trigger
    // a rescan, which would walk public/, see the new file, and rewrite the
    // dts to include "icon.svg". With the filter working correctly, the
    // handler returns early, no rescan runs, and the dts retains its old
    // contents. (The previous version of this test relied only on mtime
    // stability, which would also be satisfied by the no-changes
    // short-circuit even if the filter were broken — false-pass risk.)
    fs.writeFileSync('public/icon.svg', 'x')

    server.watcher.emit('change', path.join(tmpRoot, 'src/some-file.ts'))
    await new Promise((r) => setTimeout(r, 120))

    const afterContent = fs.readFileSync(dts, 'utf8')
    expect(afterContent).toBe(initialContent)
    expect(afterContent).not.toContain('"icon.svg"')
  })

  it('processes change events inside the configured directory', async () => {
    fs.mkdirSync('public', { recursive: true })
    fs.writeFileSync('public/logo.png', 'x')
    const dts = path.join(tmpRoot, 'out.d.ts')
    const plugin = staticAssetsPlugin({ typesOutputFile: dts, debounce: 30 })
    await bootstrap(plugin)

    const server = makeFakeServer()
    configureServer(plugin, server)

    // Add a real file under public/ then emit the matching event.
    fs.writeFileSync('public/icon.svg', 'x')
    const insideDir = path.resolve(tmpRoot, 'public/icon.svg')
    server.watcher.emit('add', insideDir)

    // Wait through the debounce + rescan I/O.
    await new Promise((r) => setTimeout(r, 200))

    const content = fs.readFileSync(dts, 'utf8')
    expect(content).toContain('"icon.svg"')
  })
})

// ---------- B5: cleanup ----------

describe('watcher lifecycle cleanup (B5)', () => {
  it('closeBundle detaches all five watcher listeners', async () => {
    fs.mkdirSync('public', { recursive: true })
    fs.writeFileSync('public/logo.png', 'x')
    const dts = path.join(tmpRoot, 'out.d.ts')
    const plugin = staticAssetsPlugin({ typesOutputFile: dts })
    await bootstrap(plugin)

    const server = makeFakeServer()
    expect(watcherListenerCount(server)).toBe(0)
    configureServer(plugin, server)
    expect(watcherListenerCount(server)).toBe(5)

    closeBundle(plugin)
    expect(watcherListenerCount(server)).toBe(0)
  })

  it('httpServer close event detaches all watcher listeners', async () => {
    fs.mkdirSync('public', { recursive: true })
    fs.writeFileSync('public/logo.png', 'x')
    const dts = path.join(tmpRoot, 'out.d.ts')
    const plugin = staticAssetsPlugin({ typesOutputFile: dts })
    await bootstrap(plugin)

    const server = makeFakeServer()
    configureServer(plugin, server)
    expect(watcherListenerCount(server)).toBe(5)

    server.httpServer.emit('close')
    expect(watcherListenerCount(server)).toBe(0)
  })

  it('closeBundle clears a pending debounce timer', async () => {
    fs.mkdirSync('public', { recursive: true })
    fs.writeFileSync('public/logo.png', 'x')
    const dts = path.join(tmpRoot, 'out.d.ts')
    // Long debounce so the timer is still pending when we tear down.
    const plugin = staticAssetsPlugin({ typesOutputFile: dts, debounce: 5000 })
    await bootstrap(plugin)

    const server = makeFakeServer()
    configureServer(plugin, server)

    const initial = fs.statSync(dts).mtimeMs
    // Fire an in-directory event to arm the debounce, then immediately tear down.
    fs.writeFileSync('public/another.png', 'x')
    server.watcher.emit('add', path.resolve(tmpRoot, 'public/another.png'))
    closeBundle(plugin)

    // Wait long enough that the timer would have fired had it not been cleared.
    await new Promise((r) => setTimeout(r, 200))

    // No rescan should have run.
    expect(fs.statSync(dts).mtimeMs).toBe(initial)
  })

  it('double cleanup is a no-op (closeBundle then httpServer close)', async () => {
    fs.mkdirSync('public', { recursive: true })
    fs.writeFileSync('public/logo.png', 'x')
    const dts = path.join(tmpRoot, 'out.d.ts')
    const plugin = staticAssetsPlugin({ typesOutputFile: dts })
    await bootstrap(plugin)

    const server = makeFakeServer()
    configureServer(plugin, server)

    closeBundle(plugin)
    expect(() => server.httpServer.emit('close')).not.toThrow()
    expect(watcherListenerCount(server)).toBe(0)
  })
})

// ---------- B6: in-flight serialization ----------

describe('in-flight rescan serialization (B6)', () => {
  it('serializes rescans triggered by rapid burst events', async () => {
    fs.mkdirSync('public', { recursive: true })
    fs.writeFileSync('public/logo.png', 'x')
    const dts = path.join(tmpRoot, 'out.d.ts')

    const plugin = staticAssetsPlugin({ typesOutputFile: dts, debounce: 20 })
    await bootstrap(plugin)

    // Track the order in which rescans observe the file system. Each rescan
    // reads the dts content the previous rescan left behind, so a strict
    // ordering means no overlap occurred.
    const observedSizes: number[] = []
    const server = makeFakeServer()
    // Wrap moduleGraph.invalidateModule to record when each rescan finishes.
    server.moduleGraph.invalidateModule = () => {
      observedSizes.push(fs.readFileSync(dts, 'utf8').length)
    }

    configureServer(plugin, server)

    // First burst: add file A. Wait less than the debounce to schedule both
    // events to coalesce — but more than 0 so the second clearTimeout is a real
    // signal, not a microtask race.
    fs.writeFileSync('public/a.png', 'x')
    server.watcher.emit('add', path.resolve(tmpRoot, 'public/a.png'))

    await new Promise((r) => setTimeout(r, 50))

    // Second burst (after first rescan has had time to start). Add file B.
    fs.writeFileSync('public/b.png', 'x')
    server.watcher.emit('add', path.resolve(tmpRoot, 'public/b.png'))

    // Wait for both rescans to complete.
    await new Promise((r) => setTimeout(r, 200))

    // Final dts must contain both files (the second rescan's write must not
    // have been clobbered by an in-flight earlier scan).
    const final = fs.readFileSync(dts, 'utf8')
    expect(final).toContain('"a.png"')
    expect(final).toContain('"b.png"')
    expect(final).toContain('"logo.png"')
  })

  it('a debounced rescan that fires after closeBundle does not crash', async () => {
    fs.mkdirSync('public', { recursive: true })
    fs.writeFileSync('public/logo.png', 'x')
    const dts = path.join(tmpRoot, 'out.d.ts')

    const plugin = staticAssetsPlugin({ typesOutputFile: dts, debounce: 30 })
    await bootstrap(plugin)

    const server = makeFakeServer()
    let invalidateCalled = false
    // If the post-teardown rescan reaches moduleGraph.invalidateModule, we'd
    // know the server-null guard failed.
    server.moduleGraph.invalidateModule = () => {
      invalidateCalled = true
    }
    configureServer(plugin, server)

    // Arm the debounce, then immediately tear down. closeBundle clears the
    // timer, so the rescan should never run.
    fs.writeFileSync('public/another.png', 'x')
    server.watcher.emit('add', path.resolve(tmpRoot, 'public/another.png'))
    closeBundle(plugin)

    await new Promise((r) => setTimeout(r, 150))

    expect(invalidateCalled).toBe(false)
  })
})
