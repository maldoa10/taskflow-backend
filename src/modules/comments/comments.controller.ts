import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AuthenticatedRequest } from '../../shared/types'
import { Errors } from '../../shared/errors'
import * as service from './comments.service'
import { broadcast } from '../../websocket/rooms'

const p = (v: string | string[]) => (Array.isArray(v) ? v[0] : v)

const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
})

export async function getComments(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const comments = await service.getComments(p(req.params.taskId), user.id)
    res.json({ comments })
  } catch (err) {
    next(err)
  }
}

export async function createComment(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const input = createCommentSchema.safeParse(req.body)
    if (!input.success) return next(Errors.validationError(input.error.flatten().fieldErrors))

    const { comment, boardId } = await service.createComment(
      p(req.params.taskId),
      user.id,
      input.data.content
    )

    // Broadcast to all board members (including sender — they see their own comment appear)
    broadcast(boardId, { type: 'COMMENT_ADDED', payload: comment })

    res.status(201).json({ comment })
  } catch (err) {
    next(err)
  }
}
