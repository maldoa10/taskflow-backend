import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate'
import { registerHandler, loginHandler, meHandler, refreshHandler } from './auth.controller'

const router = Router()

router.post('/register', registerHandler)
router.post('/login', loginHandler)
router.post('/refresh', refreshHandler)
router.get('/me', authenticate, meHandler)

export default router
