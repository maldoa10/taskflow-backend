import { prismaMock, mockFn } from '../../__mocks__/prisma'
import * as invitationsService from '../../../src/modules/invitations/invitations.service'

const boardMember = prismaMock.boardMember as any
const user = prismaMock.user as any
const board = prismaMock.board as any

// invitation no está en el mock base, lo extendemos
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

const mockInviteeUser = { ...mockUser, id: 'user-999', email: mockInviteeEmail }

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

beforeEach(() => {
  jest.clearAllMocks()
})

// inviteToBoard

describe('invitationsService.inviteToBoard', () => {
  it('crea una invitación si el invitador es OWNER y el email no es miembro', async () => {
    mockFn(boardMember, 'findUnique')
      .mockResolvedValueOnce(mockOwnerMember)  // assertOwner
      .mockResolvedValueOnce(null)             // existingMember check
    mockFn(user, 'findUnique').mockResolvedValue(mockInviteeUser)
    invitation.findFirst.mockResolvedValue(null)
    invitation.create.mockResolvedValue(mockInvitation)

    const result = await invitationsService.inviteToBoard(mockBoardId, mockUserId, mockInviteeEmail)

    expect(invitation.create).toHaveBeenCalled()
    expect(result).toMatchObject({ id: 'inv-001', status: 'PENDING' })
  })

  it('crea invitación si el email no tiene cuenta aún', async () => {
    mockFn(boardMember, 'findUnique').mockResolvedValueOnce(mockOwnerMember)
    mockFn(user, 'findUnique').mockResolvedValue(null) // no existe en DB
    invitation.findFirst.mockResolvedValue(null)
    invitation.create.mockResolvedValue(mockInvitation)

    const result = await invitationsService.inviteToBoard(mockBoardId, mockUserId, mockInviteeEmail)

    expect(invitation.create).toHaveBeenCalled()
    expect(result).toMatchObject({ email: mockInviteeEmail })
  })

  it('lanza FORBIDDEN si el invitador no es OWNER', async () => {
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMemberRole)

    await expect(
      invitationsService.inviteToBoard(mockBoardId, mockUserId, mockInviteeEmail)
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 })
  })

  it('lanza FORBIDDEN si el invitador no es miembro', async () => {
    mockFn(boardMember, 'findUnique').mockResolvedValue(null)

    await expect(
      invitationsService.inviteToBoard(mockBoardId, mockUserId, mockInviteeEmail)
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 })
  })

  it('lanza CONFLICT si el invitado ya es miembro del board', async () => {
    mockFn(boardMember, 'findUnique')
      .mockResolvedValueOnce(mockOwnerMember)    // assertOwner
      .mockResolvedValueOnce({ role: 'MEMBER' }) // existingMember
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

// listPendingInvitations

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

// acceptInvitation

describe('invitationsService.acceptInvitation', () => {
  it('acepta la invitación y crea la membresía', async () => {
    const inviteeUser = { ...mockUser, id: 'user-999', email: mockInviteeEmail }
    mockFn(user, 'findUnique').mockResolvedValue(inviteeUser)
    invitation.findUnique.mockResolvedValue(mockInvitation)
    ;(prismaMock.$transaction as jest.Mock).mockResolvedValue([{}, {}])

    const result = await invitationsService.acceptInvitation('inv-001', 'user-999')

    expect(prismaMock.$transaction).toHaveBeenCalled()
    expect(result).toMatchObject({ id: 'inv-001' })
  })

  it('lanza NOT_FOUND si el usuario no existe', async () => {
    mockFn(user, 'findUnique').mockResolvedValue(null)

    await expect(invitationsService.acceptInvitation('inv-001', 'no-existe')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    })
  })

  it('lanza NOT_FOUND si la invitación no existe', async () => {
    mockFn(user, 'findUnique').mockResolvedValue(mockUser)
    invitation.findUnique.mockResolvedValue(null)

    await expect(invitationsService.acceptInvitation('no-inv', mockUserId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    })
  })

  it('lanza FORBIDDEN si el email de la invitación no coincide con el usuario', async () => {
    mockFn(user, 'findUnique').mockResolvedValue(mockUser) // email: juan@example.com
    invitation.findUnique.mockResolvedValue({ ...mockInvitation, email: 'otro@example.com' })

    await expect(invitationsService.acceptInvitation('inv-001', mockUserId)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    })
  })

  it('lanza CONFLICT si la invitación ya fue procesada', async () => {
    const inviteeUser = { ...mockUser, id: 'user-999', email: mockInviteeEmail }
    mockFn(user, 'findUnique').mockResolvedValue(inviteeUser)
    invitation.findUnique.mockResolvedValue({ ...mockInvitation, status: 'ACCEPTED' })

    await expect(invitationsService.acceptInvitation('inv-001', 'user-999')).rejects.toMatchObject({
      code: 'CONFLICT',
      statusCode: 409,
    })
  })

  it('lanza CONFLICT si la invitación está expirada', async () => {
    const inviteeUser = { ...mockUser, id: 'user-999', email: mockInviteeEmail }
    mockFn(user, 'findUnique').mockResolvedValue(inviteeUser)
    invitation.findUnique.mockResolvedValue({
      ...mockInvitation,
      expiresAt: new Date(Date.now() - 1000), // ya expiró
    })

    await expect(invitationsService.acceptInvitation('inv-001', 'user-999')).rejects.toMatchObject({
      code: 'CONFLICT',
      statusCode: 409,
    })
  })
})

// rejectInvitation

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

  it('lanza NOT_FOUND si el usuario no existe', async () => {
    mockFn(user, 'findUnique').mockResolvedValue(null)

    await expect(invitationsService.rejectInvitation('inv-001', 'no-existe')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    })
  })

  it('lanza NOT_FOUND si la invitación no existe', async () => {
    mockFn(user, 'findUnique').mockResolvedValue(mockUser)
    invitation.findUnique.mockResolvedValue(null)

    await expect(invitationsService.rejectInvitation('no-inv', mockUserId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    })
  })

  it('lanza FORBIDDEN si el email no coincide', async () => {
    mockFn(user, 'findUnique').mockResolvedValue(mockUser) // email: juan@example.com
    invitation.findUnique.mockResolvedValue({ ...mockInvitation, email: 'otro@example.com' })

    await expect(invitationsService.rejectInvitation('inv-001', mockUserId)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    })
  })

  it('lanza CONFLICT si la invitación ya fue procesada', async () => {
    const inviteeUser = { ...mockUser, id: 'user-999', email: mockInviteeEmail }
    mockFn(user, 'findUnique').mockResolvedValue(inviteeUser)
    invitation.findUnique.mockResolvedValue({ ...mockInvitation, status: 'REJECTED' })

    await expect(invitationsService.rejectInvitation('inv-001', 'user-999')).rejects.toMatchObject({
      code: 'CONFLICT',
      statusCode: 409,
    })
  })
})