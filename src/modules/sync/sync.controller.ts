import { Request, Response, NextFunction } from 'express'
import { AuthenticatedRequest } from '../../shared/types'
import { Errors } from '../../shared/errors'
import { syncBatchSchema } from './sync.validation'
import { processSyncBatch, getChanges } from './sync.service'

export async function syncBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const input = syncBatchSchema.safeParse(req.body)
    if (!input.success) return next(Errors.validationError(input.error.flatten().fieldErrors))

    const results = await processSyncBatch(input.data.operations, user.id)
    res.json({ results })
  } catch (err) {
    next(err)
  }
}

export async function syncChanges(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const since = Number(req.query.since ?? '0')
    if (isNaN(since))
      return next(Errors.validationError({ since: ['Debe ser un timestamp numérico'] }))

    const changes = await getChanges(user.id, since)
    res.json(changes)
  } catch (err) {
    next(err)
  }
}
