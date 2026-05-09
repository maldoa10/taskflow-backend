import { Router } from 'express'
import multer from 'multer'
import * as path from 'path'
import * as fs from 'fs'
import { authenticate } from '../../middleware/authenticate'
import { generalRateLimiter } from '../../middleware/rateLimiter'
import {
  getAttachments,
  uploadAttachment,
  deleteAttachment,
  downloadAttachment,
} from './attachments.controller'

// Configure multer for file uploads
const TEMP_DIR = path.join(process.cwd(), 'uploads', 'temp')
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, TEMP_DIR)
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(7)}`
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`)
  },
})

const upload = multer({
  storage,
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
