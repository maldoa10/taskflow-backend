import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/generated/**', '!src/server.ts', '!src/database/**', '!src/config/env.ts', '!src/utils/logger.ts'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: { lines: 70 },
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
    }],
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
}

export default config
