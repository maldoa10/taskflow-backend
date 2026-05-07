import { Request, Response, NextFunction } from 'express'
import * as commentsService from '../../../src/modules/comments/comments.service'
import { getComments, createComment } from '../../../src/modules/comments/comments.controller'
import { AppError } from '../../../src/middleware/errorHandler'

jest.mock('../../../src/modules/comments/comments.service')
jest.mock('../../../src/websocket/rooms', () => ({ broadcast: jest.fn() }))
jest.mock('../../../src/modules/push/push.service', () => ({ sendPushToUser: jest.fn().mockResolvedValue(undefined) }))
jest.mock('../../../src/database/DbClient', () => ({
  prisma: { task: { findUnique: jest.fn() } },
}))

import { broadcast } from '../../../src/websocket/rooms'
import { prisma } from '../../../src/database/DbClient'

const mockCommentsService = commentsService as jest.Mocked<typeof commentsService>
const mockBroadcast = broadcast as jest.Mock
const mockTaskFindUnique = (prisma.task.findUnique as jest.Mock)

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

const mockComment = {
  id: 'comment-001',
  taskId: 'task-789',
  authorId: 'user-123',
  content: 'Buen trabajo',
  createdAt: new Date(),
  author: { id: 'user-123', name: 'Juan', email: 'juan@example.com', avatarUrl: null },
}

// getComments

describe('getComments controller', () => {
  it('responde con los comentarios de la tarea', async () => {
    mockCommentsService.getComments.mockResolvedValue([mockComment] as any)
    const req = makeReq({}, { taskId: 'task-789' })
    const res = makeRes()

    await getComments(req as Request, res as Response, next)

    expect(mockCommentsService.getComments).toHaveBeenCalledWith('task-789', 'user-123')
    expect(res.json).toHaveBeenCalledWith({ comments: [mockComment] })
    expect(next).not.toHaveBeenCalled()
  })

  it('llama next con NOT_FOUND si la tarea no existe', async () => {
    mockCommentsService.getComments.mockRejectedValue(new AppError('NOT_FOUND', 'No encontrado', 404))
    const req = makeReq({}, { taskId: 'no-existe' })
    const res = makeRes()

    await getComments(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }))
  })

  it('llama next con FORBIDDEN si el usuario no es miembro', async () => {
    mockCommentsService.getComments.mockRejectedValue(new AppError('FORBIDDEN', 'Sin acceso', 403))
    const req = makeReq({}, { taskId: 'task-789' })
    const res = makeRes()

    await getComments(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }))
  })
})

// createComment

describe('createComment controller', () => {
  const validBody = { content: 'Gran avance!' }

  it('responde 201, hace broadcast y no envía push si no hay assignee', async () => {
    mockCommentsService.createComment.mockResolvedValue({
      comment: mockComment,
      boardId: 'board-456',
    } as any)
    mockTaskFindUnique.mockResolvedValue({ assigneeId: null })

    const req = makeReq(validBody, { taskId: 'task-789' })
    const res = makeRes()

    await createComment(req as Request, res as Response, next)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ comment: mockComment })
    expect(mockBroadcast).toHaveBeenCalledWith(
      'board-456',
      expect.objectContaining({ type: 'COMMENT_ADDED' })
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('envía push si la tarea tiene assignee distinto al autor', async () => {
    const { sendPushToUser } = require('../../../src/modules/push/push.service')
    mockCommentsService.createComment.mockResolvedValue({
      comment: mockComment,
      boardId: 'board-456',
    } as any)
    mockTaskFindUnique.mockResolvedValue({ assigneeId: 'other-user-999' })

    const req = makeReq(validBody, { taskId: 'task-789' })
    const res = makeRes()

    await createComment(req as Request, res as Response, next)

    expect(sendPushToUser).toHaveBeenCalledWith(
      'other-user-999',
      expect.objectContaining({ title: 'Nuevo comentario en tu tarea' })
    )
  })

  it('no envía push si el assignee es el propio autor del comentario', async () => {
    const { sendPushToUser } = require('../../../src/modules/push/push.service')
    mockCommentsService.createComment.mockResolvedValue({
      comment: mockComment,
      boardId: 'board-456',
    } as any)
    // assigneeId === user.id
    mockTaskFindUnique.mockResolvedValue({ assigneeId: 'user-123' })

    const req = makeReq(validBody, { taskId: 'task-789' })
    const res = makeRes()

    await createComment(req as Request, res as Response, next)

    expect(sendPushToUser).not.toHaveBeenCalled()
  })

  it('llama next con VALIDATION_ERROR si content está vacío', async () => {
    const req = makeReq({ content: '' }, { taskId: 'task-789' })
    const res = makeRes()

    await createComment(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }))
    expect(mockCommentsService.createComment).not.toHaveBeenCalled()
  })

  it('llama next con VALIDATION_ERROR si content supera 2000 caracteres', async () => {
    const req = makeReq({ content: 'A'.repeat(2001) }, { taskId: 'task-789' })
    const res = makeRes()

    await createComment(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }))
  })

  it('llama next si el servicio falla', async () => {
    mockCommentsService.createComment.mockRejectedValue(new AppError('FORBIDDEN', 'Sin acceso', 403))
    const req = makeReq(validBody, { taskId: 'task-789' })
    const res = makeRes()

    await createComment(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }))
  })
})