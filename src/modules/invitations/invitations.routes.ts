import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate'
import { generalRateLimiter, sensitiveRateLimiter } from '../../middleware/rateLimiter'
import { listInvitations, acceptInvitation, rejectInvitation } from './invitations.controller'

const router = Router()

router.use(generalRateLimiter)
router.use(authenticate)
router.get('/', listInvitations)
router.post('/:id/accept', sensitiveRateLimiter, acceptInvitation)
router.post('/:id/reject', sensitiveRateLimiter, rejectInvitation)

export default router
