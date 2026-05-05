import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate'
import { getComments, createComment } from './comments.controller'

// mergeParams: true so :taskId from parent route is available
const router = Router({ mergeParams: true })

router.use(authenticate)
router.get('/', getComments)
router.post('/', createComment)

export default router
