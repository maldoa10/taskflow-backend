import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate'
import * as ctrl from './tasks.controller'

const router = Router()

router.use(authenticate)

// Montado en /api/tasks
router.patch('/:id', ctrl.updateTask)
router.delete('/:id', ctrl.deleteTask)
router.patch('/:id/move', ctrl.moveTask)

export default router
