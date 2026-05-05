import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate'
import { listInvitations, acceptInvitation, rejectInvitation } from './invitations.controller'

const router = Router()

router.use(authenticate)
router.get('/', listInvitations)
router.post('/:id/accept', acceptInvitation)
router.post('/:id/reject', rejectInvitation)

export default router
