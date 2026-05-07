import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate'
import { generalRateLimiter } from '../../middleware/rateLimiter'
import * as ctrl from './boards.controller'
import { inviteToBoard } from '../invitations/invitations.controller'

const router = Router()

router.use(generalRateLimiter)
router.use(authenticate)

router.get('/', ctrl.listBoards)
router.post('/', ctrl.createBoard)
router.get('/:id', ctrl.getBoard)
router.patch('/:id', ctrl.updateBoard)
router.delete('/:id', ctrl.deleteBoard)

// Invitations for a specific board
router.post('/:boardId/invite', inviteToBoard)

export default router
