import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { Errors } from '../../shared/errors'
import { logger } from '../../utils/logger'
import { authenticate } from '../../middleware/authenticate'
import { sensitiveRateLimiter, generalRateLimiter } from '../../middleware/rateLimiter'
import { registerHandler, loginHandler, meHandler, refreshHandler } from './auth.controller'

const router = Router()

router.post('/register', sensitiveRateLimiter, registerHandler)
router.post('/login', sensitiveRateLimiter, loginHandler)
router.post('/refresh', generalRateLimiter, refreshHandler)
router.get('/me', generalRateLimiter, authenticate, meHandler)

export default router
