import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AuthenticatedRequest } from '../../shared/types'
import { Errors } from '../../shared/errors'
import { saveSubscription, removeSubscription } from './push.service'
import { env } from '../../config/env'

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

export async function getVapidPublicKey(_req: Request, res: Response) {
  res.json({ publicKey: env.VAPID_PUBLIC_KEY ?? null })
}

export async function subscribe(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const input = subscribeSchema.safeParse(req.body)
    if (!input.success) return next(Errors.validationError(input.error.flatten().fieldErrors))

    const { endpoint, keys } = input.data
    await saveSubscription(user.id, endpoint, keys.p256dh, keys.auth)
    res.status(201).json({ ok: true })
  } catch (err) {
    next(err)
  }
}

export async function unsubscribe(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const { endpoint } = req.body as { endpoint?: string }
    if (!endpoint) return next(Errors.validationError({ endpoint: ['requerido'] }))

    await removeSubscription(user.id, endpoint)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
