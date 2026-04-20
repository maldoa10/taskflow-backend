import { Request, Response, NextFunction } from 'express'
import { AuthenticatedRequest } from '../../shared/types'
import { Errors } from '../../shared/errors'
import * as service from './tasks.service'
import { createTaskSchema, updateTaskSchema, moveTaskSchema } from './tasks.validation'

const p = (v: string | string[]) => (Array.isArray(v) ? v[0] : v)

export async function getBoardTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const tasks = await service.getBoardTasks(p(req.params.boardId), user.id)
    res.json({ tasks })
  } catch (err) { next(err) }
}

export async function createTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const input = createTaskSchema.safeParse(req.body)
    if (!input.success) return next(Errors.validationError(input.error.flatten().fieldErrors))
    const task = await service.createTask(p(req.params.boardId), user.id, input.data)
    res.status(201).json({ task })
  } catch (err) { next(err) }
}

export async function updateTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const input = updateTaskSchema.safeParse(req.body)
    if (!input.success) return next(Errors.validationError(input.error.flatten().fieldErrors))
    const task = await service.updateTask(p(req.params.id), user.id, input.data)
    res.json({ task })
  } catch (err) { next(err) }
}

export async function deleteTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    await service.deleteTask(p(req.params.id), user.id)
    res.status(204).send()
  } catch (err) { next(err) }
}

export async function moveTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const input = moveTaskSchema.safeParse(req.body)
    if (!input.success) return next(Errors.validationError(input.error.flatten().fieldErrors))
    const task = await service.moveTask(p(req.params.id), user.id, input.data)
    res.json({ task })
  } catch (err) { next(err) }
}
