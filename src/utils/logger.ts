import pino from 'pino'
import { env } from '../config/env'

export const logger = pino({
  // production: info+  |  development: warn+ (silences debug/info noise in console)
  level: env.NODE_ENV === 'production' ? 'info' : 'warn',
  transport:
    env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
          },
        }
      : undefined,
})
