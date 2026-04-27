import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate'
import { generalRateLimiter } from '../../middleware/rateLimiter'
import * as ctrl from './tasks.controller'

const router = Router({ mergeParams: true })

router.use(generalRateLimiter)
router.use(authenticate)

// Montado en /api/boards/:boardId/tasks
router.get('/', ctrl.getBoardTasks)
router.post('/', ctrl.createTask)

export default router
