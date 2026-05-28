import { randomUUID } from 'crypto'
import { prisma } from '../../database/DbClient'
import { Errors } from '../../shared/errors'
import { sendPushToUser } from '../push/push.service'

async function assertOwner(boardId: string, userId: string) {
  const member = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
  })
  if (!member || member.role !== 'OWNER') throw Errors.forbidden()
}

export async function inviteToBoard(boardId: string, inviterId: string, email: string) {
  await assertOwner(boardId, inviterId)

  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    const existingMember = await prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: existingUser.id } },
    })
    if (existingMember) throw Errors.conflict('El usuario ya es miembro del tablero')
  }

  const existing = await prisma.invitation.findFirst({
    where: { boardId, email, status: 'PENDING' },
  })
  if (existing) throw Errors.conflict('Ya existe una invitación pendiente para ese email')

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const invitation = await prisma.invitation.create({
    data: { boardId, email, inviterId, token: randomUUID(), expiresAt },
    include: {
      board: { select: { name: true } },
      inviter: { select: { name: true } },
    },
  })

  if (existingUser) {
    await sendPushToUser(existingUser.id, {
      title: 'Nueva invitación',
      body: `${invitation.inviter.name} te invitó al tablero "${invitation.board.name}"`,
      url: '/invitations',
    })
  }

  const { board: _board, inviter: _inviter, ...invitationWithoutIncludes } = invitation
  return invitationWithoutIncludes
}

export async function listPendingInvitations(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw Errors.notFound('Usuario')

  return prisma.invitation.findMany({
    where: {
      email: user.email,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    include: {
      board: true,
      inviter: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function acceptInvitation(invitationId: string, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw Errors.notFound('Usuario')

  const invitation = await prisma.invitation.findUnique({ where: { id: invitationId } })
  if (!invitation) throw Errors.notFound('Invitación')
  if (invitation.email !== user.email) throw Errors.forbidden()
  if (invitation.status !== 'PENDING') throw Errors.conflict('Invitación ya procesada')
  if (invitation.expiresAt < new Date()) throw Errors.conflict('Invitación expirada')

  await prisma.$transaction([
    prisma.boardMember.create({
      data: { boardId: invitation.boardId, userId, role: 'MEMBER' },
    }),
    prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'ACCEPTED' },
    }),
  ])

  return invitation
}

export async function rejectInvitation(invitationId: string, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw Errors.notFound('Usuario')

  const invitation = await prisma.invitation.findUnique({ where: { id: invitationId } })
  if (!invitation) throw Errors.notFound('Invitación')
  if (invitation.email !== user.email) throw Errors.forbidden()
  if (invitation.status !== 'PENDING') throw Errors.conflict('Invitación ya procesada')

  return prisma.invitation.update({
    where: { id: invitationId },
    data: { status: 'REJECTED' },
  })
}
