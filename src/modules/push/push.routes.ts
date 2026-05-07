import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate'
import { generalRateLimiter, sensitiveRateLimiter } from '../../middleware/rateLimiter'
import { getVapidPublicKey, subscribe, unsubscribe } from './push.controller'

const router = Router()

router.get('/vapid-public-key', generalRateLimiter, getVapidPublicKey)
router.post('/subscribe', sensitiveRateLimiter, authenticate, subscribe)
router.delete('/subscribe', sensitiveRateLimiter, authenticate, unsubscribe)

export default router
