import { prismaMock, mockFn } from '../../__mocks__/prisma'
import * as boardsService from '../../../src/modules/boards/boards.service'

const boardMember = prismaMock.boardMember as any
const board = prismaMock.board as any

const mockUserId = 'user-123'
const mockBoardId = 'board-456'

const mockOwnerMember = {
  boardId: mockBoardId,
  userId: mockUserId,
  role: 'OWNER',
  joinedAt: new Date(),
}

const mockViewerMember = {
  boardId: mockBoardId,
  userId: mockUserId,
  role: 'MEMBER',
  joinedAt: new Date(),
}

const mockBoard = {
  id: mockBoardId,
  name: 'Mi Tablero',
  description: 'Descripción',
  color: '#6366F1',
  ownerId: mockUserId,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockBoardFull = {
  ...mockBoard,
  columns: [],
  members: [],
}

beforeEach(() => {
  jest.clearAllMocks()
})

// listBoards

describe('boardsService.listBoards', () => {
  it('devuelve los tableros del usuario con su rol', async () => {
    const memberships = [
      { ...mockOwnerMember, board: { ...mockBoard, _count: { tasks: 2, members: 1 } } },
    ]
    mockFn(boardMember, 'findMany').mockResolvedValue(memberships)

    const result = await boardsService.listBoards(mockUserId)

    expect(boardMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: mockUserId } })
    )
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: mockBoardId, role: 'OWNER' })
  })

  it('devuelve array vacío si el usuario no tiene tableros', async () => {
    mockFn(boardMember, 'findMany').mockResolvedValue([])

    const result = await boardsService.listBoards(mockUserId)
    expect(result).toEqual([])
  })
})

// createBoard

describe('boardsService.createBoard', () => {
  const input = { name: 'Nuevo Tablero', color: '#6366F1' }

  it('crea un tablero con columnas por defecto y devuelve el tablero completo', async () => {
    // $transaction ejecuta el callback y retorna lo que retorna el callback
    ; (prismaMock.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      const tx = {
        board: { create: jest.fn().mockResolvedValue(mockBoard) },
        boardMember: { create: jest.fn().mockResolvedValue(mockOwnerMember) },
        column: { createMany: jest.fn().mockResolvedValue({ count: 3 }) },
      }
      return cb(tx)
    })
    // getBoard internamente llama boardMember.findUnique + board.findUnique
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockOwnerMember)
    mockFn(board, 'findUnique').mockResolvedValue(mockBoardFull)

    const result = await boardsService.createBoard(mockUserId, input)

    expect(result).toMatchObject({ id: mockBoardId, name: mockBoard.name })
  })
})

// getBoard

describe('boardsService.getBoard', () => {
  it('devuelve el tablero si el usuario es miembro', async () => {
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockOwnerMember)
    mockFn(board, 'findUnique').mockResolvedValue(mockBoardFull)

    const result = await boardsService.getBoard(mockBoardId, mockUserId)

    expect(board.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: mockBoardId } })
    )
    expect(result).toMatchObject({ id: mockBoardId })
  })

  it('lanza FORBIDDEN si el usuario no es miembro', async () => {
    mockFn(boardMember, 'findUnique').mockResolvedValue(null)

    await expect(boardsService.getBoard(mockBoardId, mockUserId)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    })
  })

  it('lanza NOT_FOUND si el tablero no existe en DB', async () => {
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockOwnerMember)
    mockFn(board, 'findUnique').mockResolvedValue(null)

    await expect(boardsService.getBoard(mockBoardId, mockUserId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    })
  })
})

// updateBoard

describe('boardsService.updateBoard', () => {
  const input = { name: 'Tablero Actualizado' }

  it('actualiza el tablero si el usuario es miembro', async () => {
    const updatedBoard = { ...mockBoard, name: 'Tablero Actualizado' }
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockViewerMember)
    mockFn(board, 'update').mockResolvedValue(updatedBoard)

    const result = await boardsService.updateBoard(mockBoardId, mockUserId, input)

    expect(board.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: mockBoardId }, data: input })
    )
    expect(result).toMatchObject({ name: 'Tablero Actualizado' })
  })

  it('lanza FORBIDDEN si el usuario no es miembro', async () => {
    mockFn(boardMember, 'findUnique').mockResolvedValue(null)

    await expect(boardsService.updateBoard(mockBoardId, mockUserId, input)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    })
  })
})

// deleteBoard

describe('boardsService.deleteBoard', () => {
  it('elimina el tablero si el usuario es OWNER', async () => {
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockOwnerMember)
    mockFn(board, 'delete').mockResolvedValue(mockBoard)

    await boardsService.deleteBoard(mockBoardId, mockUserId)

    expect(board.delete).toHaveBeenCalledWith({ where: { id: mockBoardId } })
  })

  it('lanza FORBIDDEN si el usuario no es miembro', async () => {
    mockFn(boardMember, 'findUnique').mockResolvedValue(null)

    await expect(boardsService.deleteBoard(mockBoardId, mockUserId)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    })
  })

  it('lanza FORBIDDEN si el usuario es MEMBER (no OWNER)', async () => {
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockViewerMember)

    await expect(boardsService.deleteBoard(mockBoardId, mockUserId)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    })
  })
})