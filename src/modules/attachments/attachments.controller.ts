import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AuthenticatedRequest } from '../../shared/types'
import { Errors } from '../../shared/errors'
import * as service from './attachments.service'
import { broadcast } from '../../websocket/rooms'

const p = (v: string | string[]) => (Array.isArray(v) ? v[0] : v)

const base64UploadSchema = z.object({
  data: z.string().min(1),
  originalName: z.string().optional(),
  mimeType: z.string().regex(/^image\/(jpeg|jpg|png|gif|webp)$/i),
})

export async function getAttachments(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const attachments = await service.getAttachments(p(req.params.taskId), user.id)
    res.json({ attachments })
  } catch (err) {
    next(err)
  }
}

export async function uploadAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const taskId = p(req.params.taskId)

    // Handle multipart file upload
    if (req.file) {
      // Validate mime type
      if (!req.file.mimetype.startsWith('image/')) {
        return next(Errors.validationError({ file: ['Solo se permiten imágenes'] }))
      }

      const { attachment, boardId } = await service.createAttachment(taskId, user.id, req.file)

      // Broadcast to all board members
      broadcast(boardId, { type: 'ATTACHMENT_ADDED', payload: { taskId, attachment } })

      return res.status(201).json({ attachment })
    }

    // Handle base64 upload (from camera capture)
    const input = base64UploadSchema.safeParse(req.body)
    if (!input.success) {
      return next(Errors.validationError(input.error.flatten().fieldErrors))
    }

    const { attachment, boardId } = await service.createAttachmentFromBase64(
      taskId,
      user.id,
      input.data.data,
      input.data.originalName || 'camera-capture.jpg',
      input.data.mimeType
    )

    // Broadcast to all board members
    broadcast(boardId, { type: 'ATTACHMENT_ADDED', payload: { taskId, attachment } })

    res.status(201).json({ attachment })
  } catch (err) {
    next(err)
  }
}

export async function deleteAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const attachmentId = p(req.params.attachmentId)

    const { boardId } = await service.deleteAttachment(attachmentId, user.id)

    // Broadcast to all board members
    broadcast(boardId, {
      type: 'ATTACHMENT_DELETED',
      payload: { attachmentId, taskId: p(req.params.taskId) },
    })

    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

export async function downloadAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const attachmentId = p(req.params.attachmentId)

    const { filepath, attachment } = await service.getAttachmentFile(attachmentId, user.id)

    res.setHeader('Content-Type', attachment.mimeType)
    res.setHeader('Content-Disposition', `inline; filename="${attachment.originalName}"`)
    res.sendFile(filepath)
  } catch (err) {
    next(err)
  }
}
