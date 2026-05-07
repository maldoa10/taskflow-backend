import { Request, Response, NextFunction } from 'express'
import * as invitationsService from '../../../src/modules/invitations/invitations.service'
import {
  inviteToBoard,
  listInvitations,
  acceptInvitation,
  rejectInvitation,
} from '../../../src/modules/invitations/invitations.controller'
import { AppError } from '../../../src/middleware/errorHandler'

jest.mock('../../../src/modules/invitations/invitations.service')
jest.mock('../../../src/websocket/rooms', () => ({ broadcast: jest.fn() }))

import { broadcast } from '../../../src/websocket/rooms'

const mockInvitationsService = invitationsService as jest.Mocked<typeof invitationsService>
const mockBroadcast = broadcast as jest.Mock

function makeRes(): Partial<Response> {
  const res: Partial<Response> = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

function makeReq(body = {}, params = {}, extra = {}): Partial<Request> {
  return { body, params, user: { id: 'user-123', name: 'Juan' }, ...extra } as any
}

const next = jest.fn() as jest.MockedFunction<NextFunction>

beforeEach(() => {
  jest.clearAllMocks()
})

const mockInvitation = {
  id: 'inv-001',
  boardId: 'board-456',
  email: 'invitado@example.com',
  status: 'PENDING',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
}

// inviteToBoard

describe('inviteToBoard controller', () => {
  const validBody = { email: 'invitado@example.com' }

  it('responde 201 con la invitación creada', async () => {
    mockInvitationsService.inviteToBoard.mockResolvedValue(mockInvitation as any)
    const req = makeReq(validBody, { boardId: 'board-456' })
    const res = makeRes()

    await inviteToBoard(req as Request, res as Response, next)

    expect(mockInvitationsService.inviteToBoard).toHaveBeenCalledWith(
      'board-456', 'user-123', 'invitado@example.com'
    )
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ invitation: mockInvitation })
    expect(next).not.toHaveBeenCalled()
  })

  it('llama next con VALIDATION_ERROR si email es inválido', async () => {
    const req = makeReq({ email: 'no-es-email' }, { boardId: 'board-456' })
    const res = makeRes()

    await inviteToBoard(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }))
    expect(mockInvitationsService.inviteToBoard).not.toHaveBeenCalled()
  })

  it('llama next con FORBIDDEN si el usuario no es OWNER', async () => {
    mockInvitationsService.inviteToBoard.mockRejectedValue(new AppError('FORBIDDEN', 'Sin acceso', 403))
    const req = makeReq(validBody, { boardId: 'board-456' })
    const res = makeRes()

    await inviteToBoard(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }))
  })

  it('llama next con CONFLICT si ya existe invitación pendiente', async () => {
    mockInvitationsService.inviteToBoard.mockRejectedValue(new AppError('CONFLICT', 'Ya existe', 409))
    const req = makeReq(validBody, { boardId: 'board-456' })
    const res = makeRes()

    await inviteToBoard(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'CONFLICT' }))
  })
})

// listInvitations

describe('listInvitations controller', () => {
  it('devuelve las invitaciones pendientes del usuario', async () => {
    mockInvitationsService.listPendingInvitations.mockResolvedValue([mockInvitation] as any)
    const req = makeReq()
    const res = makeRes()

    await listInvitations(req as Request, res as Response, next)

    expect(mockInvitationsService.listPendingInvitations).toHaveBeenCalledWith('user-123')
    expect(res.json).toHaveBeenCalledWith({ invitations: [mockInvitation] })
    expect(next).not.toHaveBeenCalled()
  })

  it('llama next si el servicio falla', async () => {
    mockInvitationsService.listPendingInvitations.mockRejectedValue(new AppError('NOT_FOUND', 'No encontrado', 404))
    const req = makeReq()
    const res = makeRes()

    await listInvitations(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }))
  })
})

// acceptInvitation

describe('acceptInvitation controller', () => {
  it('acepta la invitación y hace broadcast a los miembros del board', async () => {
    mockInvitationsService.acceptInvitation.mockResolvedValue(mockInvitation as any)
    const req = makeReq({}, { id: 'inv-001' })
    const res = makeRes()

    await acceptInvitation(req as Request, res as Response, next)

    expect(mockInvitationsService.acceptInvitation).toHaveBeenCalledWith('inv-001', 'user-123')
    expect(mockBroadcast).toHaveBeenCalledWith(
      'board-456',
      expect.objectContaining({ type: 'MEMBER_JOINED' })
    )
    expect(res.json).toHaveBeenCalledWith({ invitation: mockInvitation })
    expect(next).not.toHaveBeenCalled()
  })

  it('llama next con CONFLICT si la invitación está expirada', async () => {
    mockInvitationsService.acceptInvitation.mockRejectedValue(new AppError('CONFLICT', 'Expirada', 409))
    const req = makeReq({}, { id: 'inv-001' })
    const res = makeRes()

    await acceptInvitation(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'CONFLICT' }))
    expect(mockBroadcast).not.toHaveBeenCalled()
  })

  it('llama next con FORBIDDEN si el email no corresponde al usuario', async () => {
    mockInvitationsService.acceptInvitation.mockRejectedValue(new AppError('FORBIDDEN', 'Sin acceso', 403))
    const req = makeReq({}, { id: 'inv-001' })
    const res = makeRes()

    await acceptInvitation(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }))
  })
})

// rejectInvitation

describe('rejectInvitation controller', () => {
  it('rechaza la invitación correctamente', async () => {
    const rejected = { ...mockInvitation, status: 'REJECTED' }
    mockInvitationsService.rejectInvitation.mockResolvedValue(rejected as any)
    const req = makeReq({}, { id: 'inv-001' })
    const res = makeRes()

    await rejectInvitation(req as Request, res as Response, next)

    expect(mockInvitationsService.rejectInvitation).toHaveBeenCalledWith('inv-001', 'user-123')
    expect(res.json).toHaveBeenCalledWith({ invitation: rejected })
    expect(next).not.toHaveBeenCalled()
  })

  it('llama next con NOT_FOUND si la invitación no existe', async () => {
    mockInvitationsService.rejectInvitation.mockRejectedValue(new AppError('NOT_FOUND', 'No encontrado', 404))
    const req = makeReq({}, { id: 'no-inv' })
    const res = makeRes()

    await rejectInvitation(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }))
  })
})