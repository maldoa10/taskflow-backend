import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/generated/**'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: { lines: 70 },
  },
  setupFilesAfterEnv: [],
}

export default config
