import { prismaMock, mockFn } from '../../__mocks__/prisma'
import * as invitationsService from '../../../src/modules/invitations/invitations.service'
import { sendPushToUser } from '../../../src/modules/push/push.service'

jest.mock('../../../src/modules/push/push.service', () => ({
  sendPushToUser: jest.fn(),
}))

const boardMember = prismaMock.boardMember as any
const user = prismaMock.user as any
const invitation = (prismaMock as any).invitation

const mockUserId = 'user-123'
const mockBoardId = 'board-456'
const mockInviteeEmail = 'invitado@example.com'

const mockOwnerMember = { boardId: mockBoardId, userId: mockUserId, role: 'OWNER', joinedAt: new Date() }
const mockMemberRole = { boardId: mockBoardId, userId: mockUserId, role: 'MEMBER', joinedAt: new Date() }

const mockUser = {
  id: mockUserId,
  name: 'Juan',
  email: 'juan@example.com',
  passwordHash: 'hash',
  avatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockInviteeUser = { ...mockUser, id: 'user-999', email: mockInviteeEmail, name: 'Carlos' }

const mockInvitation = {
  id: 'inv-001',
  boardId: mockBoardId,
  email: mockInviteeEmail,
  inviterId: mockUserId,
  token: 'some-token',
  status: 'PENDING',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
}

const mockInvitationWithRelations = {
  ...mockInvitation,
  board: { name: 'Tablero Alfa' },
  inviter: { name: 'Juan' },
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('invitationsService.inviteToBoard', () => {
  it('crea una invitación, limpia el retorno y envía push si el usuario invitado ya existe', async () => {
    mockFn(boardMember, 'findUnique')
      .mockResolvedValueOnce(mockOwnerMember)
      .mockResolvedValueOnce(null)
    mockFn(user, 'findUnique').mockResolvedValue(mockInviteeUser)
    invitation.findFirst.mockResolvedValue(null)
    invitation.create.mockResolvedValue(mockInvitationWithRelations)

    const result = await invitationsService.inviteToBoard(mockBoardId, mockUserId, mockInviteeEmail)

    expect(invitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          board: { select: { name: true } },
          inviter: { select: { name: true } },
        },
      })
    )

    expect(result).not.toHaveProperty('board')
    expect(result).not.toHaveProperty('inviter')

    expect(sendPushToUser).toHaveBeenCalledWith('user-999', expect.objectContaining({
      title: 'Nueva invitación',
      body: 'Juan te invitó al tablero "Tablero Alfa"',
    }))
  })

  it('crea la invitación pero NO envía push si el email no está registrado', async () => {
    mockFn(boardMember, 'findUnique').mockResolvedValueOnce(mockOwnerMember)
    mockFn(user, 'findUnique').mockResolvedValue(null) // Usuario NO existe en la plataforma
    invitation.findFirst.mockResolvedValue(null)
    invitation.create.mockResolvedValue(mockInvitationWithRelations)

    const result = await invitationsService.inviteToBoard(mockBoardId, mockUserId, mockInviteeEmail)

    expect(invitation.create).toHaveBeenCalled()
    expect(result).toMatchObject({ id: 'inv-001' })
    expect(sendPushToUser).not.toHaveBeenCalled()
  })

  it('lanza FORBIDDEN si el invitador no es OWNER', async () => {
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMemberRole)

    await expect(
      invitationsService.inviteToBoard(mockBoardId, mockUserId, mockInviteeEmail)
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 })
  })

  it('lanza CONFLICT si el invitado ya es miembro del board', async () => {
    mockFn(boardMember, 'findUnique')
      .mockResolvedValueOnce(mockOwnerMember)
      .mockResolvedValueOnce({ role: 'MEMBER' })
    mockFn(user, 'findUnique').mockResolvedValue(mockInviteeUser)

    await expect(
      invitationsService.inviteToBoard(mockBoardId, mockUserId, mockInviteeEmail)
    ).rejects.toMatchObject({ code: 'CONFLICT', statusCode: 409 })
  })

  it('lanza CONFLICT si ya existe una invitación pendiente', async () => {
    mockFn(boardMember, 'findUnique').mockResolvedValueOnce(mockOwnerMember)
    mockFn(user, 'findUnique').mockResolvedValue(null)
    invitation.findFirst.mockResolvedValue(mockInvitation)

    await expect(
      invitationsService.inviteToBoard(mockBoardId, mockUserId, mockInviteeEmail)
    ).rejects.toMatchObject({ code: 'CONFLICT', statusCode: 409 })
  })
})

describe('invitationsService.listPendingInvitations', () => {
  it('devuelve las invitaciones pendientes del usuario', async () => {
    mockFn(user, 'findUnique').mockResolvedValue(mockUser)
    invitation.findMany.mockResolvedValue([mockInvitation])

    const result = await invitationsService.listPendingInvitations(mockUserId)

    expect(invitation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ email: mockUser.email, status: 'PENDING' }),
      })
    )
    expect(result).toHaveLength(1)
  })

  it('lanza NOT_FOUND si el usuario no existe', async () => {
    mockFn(user, 'findUnique').mockResolvedValue(null)

    await expect(invitationsService.listPendingInvitations('no-existe')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    })
  })
})

describe('invitationsService.acceptInvitation', () => {
  it('acepta la invitación y crea la membresía', async () => {
    const inviteeUser = { ...mockUser, id: 'user-999', email: mockInviteeEmail }
    mockFn(user, 'findUnique').mockResolvedValue(inviteeUser)
    invitation.findUnique.mockResolvedValue(mockInvitation)
      ; (prismaMock.$transaction as jest.Mock).mockResolvedValue([{}, {}])

    const result = await invitationsService.acceptInvitation('inv-001', 'user-999')

    expect(prismaMock.$transaction).toHaveBeenCalled()
    expect(result).toMatchObject({ id: 'inv-001' })
  })

  it('lanza FORBIDDEN si el email de la invitación no coincide con el usuario', async () => {
    mockFn(user, 'findUnique').mockResolvedValue(mockUser)
    invitation.findUnique.mockResolvedValue({ ...mockInvitation, email: 'otro@example.com' })

    await expect(invitationsService.acceptInvitation('inv-001', mockUserId)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    })
  })

  it('lanza CONFLICT si la invitación ya fue procesada o expiró', async () => {
    const inviteeUser = { ...mockUser, id: 'user-999', email: mockInviteeEmail }
    mockFn(user, 'findUnique').mockResolvedValue(inviteeUser)
    invitation.findUnique.mockResolvedValue({ ...mockInvitation, status: 'ACCEPTED' })

    await expect(invitationsService.acceptInvitation('inv-001', 'user-999')).rejects.toMatchObject({
      code: 'CONFLICT',
      statusCode: 409,
    })
  })
})

describe('invitationsService.rejectInvitation', () => {
  it('rechaza la invitación correctamente', async () => {
    const inviteeUser = { ...mockUser, id: 'user-999', email: mockInviteeEmail }
    mockFn(user, 'findUnique').mockResolvedValue(inviteeUser)
    invitation.findUnique.mockResolvedValue(mockInvitation)
    invitation.update.mockResolvedValue({ ...mockInvitation, status: 'REJECTED' })

    const result = await invitationsService.rejectInvitation('inv-001', 'user-999')

    expect(invitation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REJECTED' } })
    )
    expect(result).toMatchObject({ status: 'REJECTED' })
  })
})