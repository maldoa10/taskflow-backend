import { Request, Response, NextFunction } from 'express'
import { AuthenticatedRequest } from '../../shared/types'
import { Errors } from '../../shared/errors'
import * as service from './boards.service'
import { createBoardSchema, updateBoardSchema } from './boards.validation'

const p = (v: string | string[]) => (Array.isArray(v) ? v[0] : v)

export async function listBoards(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const boards = await service.listBoards(user.id)
    res.json({ boards })
  } catch (err) {
    next(err)
  }
}

export async function createBoard(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const input = createBoardSchema.safeParse(req.body)
    if (!input.success) return next(Errors.validationError(input.error.flatten().fieldErrors))
    const board = await service.createBoard(user.id, input.data)
    res.status(201).json({ board })
  } catch (err) {
    next(err)
  }
}

export async function getBoard(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const board = await service.getBoard(p(req.params.id), user.id)
    res.json({ board })
  } catch (err) {
    next(err)
  }
}

export async function updateBoard(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const input = updateBoardSchema.safeParse(req.body)
    if (!input.success) return next(Errors.validationError(input.error.flatten().fieldErrors))
    const board = await service.updateBoard(p(req.params.id), user.id, input.data)
    res.json({ board })
  } catch (err) {
    next(err)
  }
}

export async function deleteBoard(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    await service.deleteBoard(p(req.params.id), user.id)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
