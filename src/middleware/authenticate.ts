import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../modules/auth/auth.service'
import { Errors } from '../shared/errors'
import { AuthenticatedRequest } from '../shared/types'

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return next(Errors.unauthorized())
  }

  const token = authHeader.slice(7)
  try {
    const payload = verifyAccessToken(token)
    ;(req as AuthenticatedRequest).user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
    }
    next()
  } catch {
    next(Errors.unauthorized())
  }
}
