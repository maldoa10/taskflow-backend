jest.mock('../src/config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret-key-for-jest',
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    PORT: 3000,
    NODE_ENV: 'test',
  },
}))