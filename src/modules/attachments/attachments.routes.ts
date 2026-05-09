import { Router } from 'express'
import multer from 'multer'
import { authenticate } from '../../middleware/authenticate'
import { generalRateLimiter } from '../../middleware/rateLimiter'
import {
  getAttachments,
  uploadAttachment,
  deleteAttachment,
  downloadAttachment,
} from './attachments.controller'

// Configure multer to use memory storage — avoids writing unvalidated filenames to disk.
// file.buffer is used in the service; file.path never exists.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (_req, file, cb) => {
    // Only allow images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Solo se permiten imágenes'))
    }
  },
})

// mergeParams: true so :taskId from parent route is available
const router = Router({ mergeParams: true })

router.use(generalRateLimiter)
router.use(authenticate)

router.get('/', getAttachments)
router.post('/', upload.single('file'), uploadAttachment)
router.get('/:attachmentId', downloadAttachment)
router.delete('/:attachmentId', deleteAttachment)

export default router
