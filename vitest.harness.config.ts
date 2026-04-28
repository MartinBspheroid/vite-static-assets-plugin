import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/harness.test.ts'],
    testTimeout: 240_000,
    hookTimeout: 600_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
})
