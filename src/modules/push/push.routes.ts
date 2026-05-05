import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate'
import { getVapidPublicKey, subscribe, unsubscribe } from './push.controller'

const router = Router()

router.get('/vapid-public-key', getVapidPublicKey)
router.post('/subscribe', authenticate, subscribe)
router.delete('/subscribe', authenticate, unsubscribe)

export default router
