import rateLimit from 'express-rate-limit'
import { Errors } from '../shared/errors'
import { logger } from '../utils/logger'
import { env } from '../config/env'

const isDev = env.NODE_ENV !== 'production'

const makeRateLimiter = (prodMax: number, msg: string) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    // In development use much higher limits so testing doesn't get blocked
    max: isDev ? prodMax * 50 : prodMax,
    skip: () => isDev && false, // keep the limiter active but generous
    handler: (req, res) => {
      const err = Errors.tooManyRequests(msg)
      logger.warn({ ip: req.ip, path: req.url, method: req.method, code: err.code }, err.message)
      res.status(err.statusCode).json({
        error: { code: err.code, message: err.message },
      })
    },
  })

export const sensitiveRateLimiter = makeRateLimiter(
  10,
  'Demasiados intentos. Intenta de nuevo en 15 minutos.'
)

export const generalRateLimiter = makeRateLimiter(
  100,
  'Demasiadas solicitudes. Intenta de nuevo más tarde.'
)
