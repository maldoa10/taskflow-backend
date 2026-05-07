import { Request, Response, NextFunction } from 'express'
import { AuthenticatedRequest } from '../../shared/types'
import { Errors } from '../../shared/errors'
import * as service from './tasks.service'
import { createTaskSchema, updateTaskSchema, moveTaskSchema } from './tasks.validation'
import { broadcast } from '../../websocket/rooms'
import { sendPushToUser } from '../push/push.service'
import { prisma } from '../../database/DbClient'

const p = (v: string | string[]) => (Array.isArray(v) ? v[0] : v)

export async function getBoardTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const tasks = await service.getBoardTasks(p(req.params.boardId), user.id)
    res.json({ tasks })
  } catch (err) {
    next(err)
  }
}

export async function createTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const input = createTaskSchema.safeParse(req.body)
    if (!input.success) return next(Errors.validationError(input.error.flatten().fieldErrors))
    const task = await service.createTask(p(req.params.boardId), user.id, input.data)

    broadcast(task.boardId, { type: 'TASK_CREATED', payload: task })

    res.status(201).json({ task })
  } catch (err) {
    next(err)
  }
}

export async function updateTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const input = updateTaskSchema.safeParse(req.body)
    if (!input.success) return next(Errors.validationError(input.error.flatten().fieldErrors))

    // Read old assigneeId BEFORE updating so we can detect a real change
    const taskId = p(req.params.id)
    const oldTask =
      input.data.assigneeId !== undefined
        ? await prisma.task.findUnique({ where: { id: taskId }, select: { assigneeId: true } })
        : null

    const task = await service.updateTask(taskId, user.id, input.data)

    broadcast(task.boardId, { type: 'TASK_UPDATED', payload: task })

    // Push notification only when assignee actually changed to someone other than the updater
    if (
      input.data.assigneeId &&
      input.data.assigneeId !== user.id &&
      input.data.assigneeId !== oldTask?.assigneeId
    ) {
      sendPushToUser(input.data.assigneeId, {
        title: 'Nueva tarea asignada',
        body: `Se te asignó: ${task.title}`,
        url: `/board/${task.boardId}`,
      }).catch(() => {})
    }

    res.json({ task })
  } catch (err) {
    next(err)
  }
}

export async function deleteTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const taskId = p(req.params.id)
    const boardId = await service.deleteTask(taskId, user.id)

    broadcast(boardId, { type: 'TASK_DELETED', payload: { id: taskId, boardId } })

    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

export async function moveTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const input = moveTaskSchema.safeParse(req.body)
    if (!input.success) return next(Errors.validationError(input.error.flatten().fieldErrors))
    const task = await service.moveTask(p(req.params.id), user.id, input.data)

    if (task) {
      broadcast(task.boardId, { type: 'TASK_MOVED', payload: task })
    }

    res.json({ task })
  } catch (err) {
    next(err)
  }
}
