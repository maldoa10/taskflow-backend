import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AuthenticatedRequest } from '../../shared/types'
import { Errors } from '../../shared/errors'
import * as service from './invitations.service'
import { broadcast } from '../../websocket/rooms'

const p = (v: string | string[]) => (Array.isArray(v) ? v[0] : v)

const inviteSchema = z.object({
  email: z.string().email(),
})

export async function inviteToBoard(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const input = inviteSchema.safeParse(req.body)
    if (!input.success) return next(Errors.validationError(input.error.flatten().fieldErrors))

    const invitation = await service.inviteToBoard(p(req.params.boardId), user.id, input.data.email)
    res.status(201).json({ invitation })
  } catch (err) {
    next(err)
  }
}

export async function listInvitations(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const invitations = await service.listPendingInvitations(user.id)
    res.json({ invitations })
  } catch (err) {
    next(err)
  }
}

export async function acceptInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const invitation = await service.acceptInvitation(p(req.params.id), user.id)

    // Notify existing board members that a new member joined
    broadcast(invitation.boardId, {
      type: 'MEMBER_JOINED',
      payload: { boardId: invitation.boardId, userId: user.id, name: user.name },
    })

    res.json({ invitation })
  } catch (err) {
    next(err)
  }
}

export async function rejectInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = req as AuthenticatedRequest
    const invitation = await service.rejectInvitation(p(req.params.id), user.id)
    res.json({ invitation })
  } catch (err) {
    next(err)
  }
}
