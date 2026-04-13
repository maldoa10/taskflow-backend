import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { Errors } from '../../shared/errors'
import { logger } from '../../utils/logger'
import { authenticate } from '../../middleware/authenticate'
import { registerHandler, loginHandler, meHandler, refreshHandler } from './auth.controller'

const router = Router()

const makeRateLimiter = (max: number, msg: string) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    handler: (req, res) => {
      const err = Errors.tooManyRequests(msg)
      logger.warn({ ip: req.ip, path: req.url, method: req.method, code: err.code }, err.message)
      res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
        },
      })
    },
  })

const sensitiveRateLimiter = makeRateLimiter(
  10,
  'Demasiados intentos. Intenta de nuevo en 15 minutos.'
)

const generalRateLimiter = makeRateLimiter(
  100,
  'Demasiadas solicitudes. Intenta de nuevo más tarde.'
)

router.post('/register', sensitiveRateLimiter, registerHandler)
router.post('/login', sensitiveRateLimiter, loginHandler)
router.post('/refresh', generalRateLimiter, refreshHandler)
router.get('/me', generalRateLimiter, authenticate, meHandler)

export default router
