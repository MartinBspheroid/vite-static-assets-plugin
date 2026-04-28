import { execa, type ResultPromise } from 'execa'
import { setTimeout as wait } from 'node:timers/promises'
import getPort from 'get-port'

export interface ServerHandle {
  port: number
  url: string
  stop: () => Promise<void>
}

export interface SpawnServerOptions {
  cwd: string
  /** Build command + args given the assigned port. Use this to inject `--port <n>` flags. */
  command: (port: number) => { cmd: string; args: string[] }
  /** Extra env. PORT and HOST are set automatically. */
  env?: Record<string, string>
  readinessPath?: string
  readinessMarker: string
  readyTimeoutMs?: number
}

export async function spawnServer(opts: SpawnServerOptions): Promise<ServerHandle> {
  const port = await getPort()
  const url = `http://localhost:${port}`
  const { cmd, args } = opts.command(port)
  const child: ResultPromise = execa(cmd, args, {
    cwd: opts.cwd,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      ...(opts.env ?? {}),
      PORT: String(port),
      HOST: '127.0.0.1',
    },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    reject: false,
    buffer: false,
  })

  // Drain output continuously so OS pipe buffers don't fill up and block the child.
  const captured: string[] = []
  child.stdout?.on('data', (d) => captured.push(`[stdout] ${d.toString()}`))
  child.stderr?.on('data', (d) => captured.push(`[stderr] ${d.toString()}`))

  let earlyExitCode: number | null = null
  child.then(
    (r) => { earlyExitCode = r.exitCode ?? -1 },
    (r) => { earlyExitCode = (r as any)?.exitCode ?? -1 },
  )

  const ready = await waitForMarker(`${url}${opts.readinessPath ?? '/'}`, opts.readinessMarker, opts.readyTimeoutMs ?? 30_000)

  if (!ready) {
    await stop(child)
    const out = captured.join('\n').slice(0, 4000) || '(no output captured)'
    throw new Error(
      `Server at ${url} did not render marker "${opts.readinessMarker}" within timeout. ` +
        `Cwd: ${opts.cwd}\nCommand: ${cmd} ${args.join(' ')}\nExit code so far: ${earlyExitCode}\n` +
        `Captured output:\n${out}`,
    )
  }

  return {
    port,
    url,
    stop: () => stop(child),
  }
}

async function waitForMarker(url: string, marker: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  let delay = 200
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) {
        const html = await res.text()
        if (html.includes(marker)) return true
      }
    } catch {
      // not yet listening
    }
    await wait(delay)
    delay = Math.min(delay * 1.5, 1000)
  }
  return false
}

async function stop(child: ResultPromise): Promise<void> {
  if (!child.pid || child.exitCode !== null) return
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    try { child.kill('SIGTERM') } catch {}
  }
  const killed = await Promise.race([
    child.then(() => true).catch(() => true),
    wait(2_000).then(() => false),
  ])
  if (!killed && child.pid) {
    try { process.kill(-child.pid, 'SIGKILL') } catch {}
    try { await child } catch {}
  }
}
