import { Request, Response, NextFunction } from 'express'
import * as boardsService from '../../../src/modules/boards/boards.service'
import {
  listBoards,
  createBoard,
  getBoard,
  updateBoard,
  deleteBoard,
} from '../../../src/modules/boards/boards.controller'
import { AppError } from '../../../src/middleware/errorHandler'

jest.mock('../../../src/modules/boards/boards.service')

const mockBoardsService = boardsService as jest.Mocked<typeof boardsService>

// Helpers

function makeRes(): Partial<Response> {
  const res: Partial<Response> = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  res.send = jest.fn().mockReturnValue(res)
  return res
}

function makeReq(body = {}, params = {}, extra = {}): Partial<Request> {
  return { body, params, user: { id: 'user-123' }, ...extra } as any
}

const next = jest.fn() as jest.MockedFunction<NextFunction>

beforeEach(() => {
  jest.clearAllMocks()
})

const mockBoard = {
  id: 'board-456',
  name: 'Mi Tablero',
  color: '#6366F1',
  ownerId: 'user-123',
}

// listBoards

describe('listBoards controller', () => {
  it('responde con los tableros del usuario', async () => {
    mockBoardsService.listBoards.mockResolvedValue([mockBoard] as any)
    const req = makeReq()
    const res = makeRes()

    await listBoards(req as Request, res as Response, next)

    expect(mockBoardsService.listBoards).toHaveBeenCalledWith('user-123')
    expect(res.json).toHaveBeenCalledWith({ boards: [mockBoard] })
    expect(next).not.toHaveBeenCalled()
  })

  it('llama next si el servicio falla', async () => {
    mockBoardsService.listBoards.mockRejectedValue(new AppError('INTERNAL', 'Error', 500))
    const req = makeReq()
    const res = makeRes()

    await listBoards(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'INTERNAL' }))
  })
})

// createBoard

describe('createBoard controller', () => {
  const validBody = { name: 'Nuevo Tablero', color: '#FF5733' }

  it('responde 201 con el tablero creado en datos válidos', async () => {
    mockBoardsService.createBoard.mockResolvedValue(mockBoard as any)
    const req = makeReq(validBody)
    const res = makeRes()

    await createBoard(req as Request, res as Response, next)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ board: mockBoard })
    expect(next).not.toHaveBeenCalled()
  })

  it('llama next con VALIDATION_ERROR si el body es inválido', async () => {
    const req = makeReq({ color: 'no-es-hex' })
    const res = makeRes()

    await createBoard(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR' })
    )
    expect(mockBoardsService.createBoard).not.toHaveBeenCalled()
  })

  it('llama next con VALIDATION_ERROR si name está vacío', async () => {
    const req = makeReq({ name: '', color: '#6366F1' })
    const res = makeRes()

    await createBoard(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR' })
    )
  })

  it('llama next si el servicio falla', async () => {
    mockBoardsService.createBoard.mockRejectedValue(new AppError('INTERNAL', 'Error', 500))
    const req = makeReq(validBody)
    const res = makeRes()

    await createBoard(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'INTERNAL' }))
  })
})

// getBoard

describe('getBoard controller', () => {
  it('responde con el tablero solicitado', async () => {
    mockBoardsService.getBoard.mockResolvedValue(mockBoard as any)
    const req = makeReq({}, { id: 'board-456' })
    const res = makeRes()

    await getBoard(req as Request, res as Response, next)

    expect(mockBoardsService.getBoard).toHaveBeenCalledWith('board-456', 'user-123')
    expect(res.json).toHaveBeenCalledWith({ board: mockBoard })
    expect(next).not.toHaveBeenCalled()
  })

  it('llama next con FORBIDDEN si el usuario no es miembro', async () => {
    mockBoardsService.getBoard.mockRejectedValue(new AppError('FORBIDDEN', 'Sin acceso', 403))
    const req = makeReq({}, { id: 'board-456' })
    const res = makeRes()

    await getBoard(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }))
  })

  it('llama next con NOT_FOUND si el tablero no existe', async () => {
    mockBoardsService.getBoard.mockRejectedValue(new AppError('NOT_FOUND', 'No encontrado', 404))
    const req = makeReq({}, { id: 'no-existe' })
    const res = makeRes()

    await getBoard(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }))
  })
})

// updateBoard

describe('updateBoard controller', () => {
  const validBody = { name: 'Nombre Actualizado' }

  it('responde con el tablero actualizado', async () => {
    const updated = { ...mockBoard, name: 'Nombre Actualizado' }
    mockBoardsService.updateBoard.mockResolvedValue(updated as any)
    const req = makeReq(validBody, { id: 'board-456' })
    const res = makeRes()

    await updateBoard(req as Request, res as Response, next)

    expect(mockBoardsService.updateBoard).toHaveBeenCalledWith('board-456', 'user-123', validBody)
    expect(res.json).toHaveBeenCalledWith({ board: updated })
    expect(next).not.toHaveBeenCalled()
  })

  it('llama next con VALIDATION_ERROR si el color es inválido', async () => {
    const req = makeReq({ color: 'azul' }, { id: 'board-456' })
    const res = makeRes()

    await updateBoard(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR' })
    )
    expect(mockBoardsService.updateBoard).not.toHaveBeenCalled()
  })

  it('llama next si el servicio falla', async () => {
    mockBoardsService.updateBoard.mockRejectedValue(new AppError('FORBIDDEN', 'Sin acceso', 403))
    const req = makeReq(validBody, { id: 'board-456' })
    const res = makeRes()

    await updateBoard(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }))
  })
})

// deleteBoard

describe('deleteBoard controller', () => {
  it('responde 204 al eliminar un tablero', async () => {
    mockBoardsService.deleteBoard.mockResolvedValue(undefined)
    const req = makeReq({}, { id: 'board-456' })
    const res = makeRes()

    await deleteBoard(req as Request, res as Response, next)

    expect(mockBoardsService.deleteBoard).toHaveBeenCalledWith('board-456', 'user-123')
    expect(res.status).toHaveBeenCalledWith(204)
    expect(res.send).toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  it('llama next con FORBIDDEN si el usuario no es OWNER', async () => {
    mockBoardsService.deleteBoard.mockRejectedValue(new AppError('FORBIDDEN', 'Sin acceso', 403))
    const req = makeReq({}, { id: 'board-456' })
    const res = makeRes()

    await deleteBoard(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }))
  })
})