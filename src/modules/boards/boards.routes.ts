import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate'
import * as ctrl from './boards.controller'

const router = Router()

router.use(authenticate)

router.get('/', ctrl.listBoards)
router.post('/', ctrl.createBoard)
router.get('/:id', ctrl.getBoard)
router.patch('/:id', ctrl.updateBoard)
router.delete('/:id', ctrl.deleteBoard)

export default router
