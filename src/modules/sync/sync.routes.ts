import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate'
import { generalRateLimiter, sensitiveRateLimiter } from '../../middleware/rateLimiter'
import * as ctrl from './sync.controller'

const router = Router()

router.use(authenticate)

// POST /api/sync        — enviar batch de operaciones offline
// GET  /api/sync/changes — obtener cambios desde timestamp
router.post('/', sensitiveRateLimiter, ctrl.syncBatch)
router.get('/changes', generalRateLimiter, ctrl.syncChanges)

export default router
