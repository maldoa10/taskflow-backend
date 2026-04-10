import { Request, Response, NextFunction } from 'express'
import * as authService from './auth.service'
import { registerSchema, loginSchema, refreshSchema } from './auth.validation'
import { Errors } from '../../shared/errors'
import { AuthenticatedRequest } from '../../shared/types'

export async function registerHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = registerSchema.safeParse(req.body)
    if (!input.success) return next(Errors.validationError(input.error.flatten().fieldErrors))

    const result = await authService.register(input.data)
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}

export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = loginSchema.safeParse(req.body)
    if (!input.success) return next(Errors.validationError(input.error.flatten().fieldErrors))

    const result = await authService.login(input.data)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export async function meHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const user = await authService.getMe(authReq.user.id)
    res.json({ user })
  } catch (err) {
    next(err)
  }
}

export async function refreshHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = refreshSchema.safeParse(req.body)
    if (!input.success) return next(Errors.validationError(input.error.flatten().fieldErrors))

    const tokens = await authService.refreshTokens(input.data.refreshToken)
    res.json(tokens)
  } catch (err) {
    next(err)
  }
}
