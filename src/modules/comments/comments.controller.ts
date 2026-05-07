import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AuthenticatedRequest } from '../../shared/types'
import { Errors } from '../../shared/errors'
import * as service from './comments.service'
import { broadcast } from '../../websocket/rooms'
import { sendPushToUser } from '../push/push.service'
import { prisma } from '../../database/DbClient'

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

    // Push notification to the task's assignee (if it's not the commenter)
    const task = await prisma.task.findUnique({ where: { id: p(req.params.taskId) } })
    if (task?.assigneeId && task.assigneeId !== user.id) {
      sendPushToUser(task.assigneeId, {
        title: 'Nuevo comentario en tu tarea',
        body: `${user.name}: ${comment.content.slice(0, 80)}`,
        url: `/board/${boardId}`,
      }).catch(() => {})
    }

    res.status(201).json({ comment })
  } catch (err) {
    next(err)
  }
}
