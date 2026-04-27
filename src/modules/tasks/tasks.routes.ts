import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate'
import { generalRateLimiter } from '../../middleware/rateLimiter'
import * as ctrl from './tasks.controller'

const router = Router({ mergeParams: true })

router.use(authenticate)
router.use(generalRateLimiter)

// Montado en /api/boards/:boardId/tasks
router.get('/', ctrl.getBoardTasks)
router.post('/', ctrl.createTask)

export default router
