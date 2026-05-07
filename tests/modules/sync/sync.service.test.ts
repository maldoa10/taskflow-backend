import { prismaMock, mockFn } from '../../__mocks__/prisma'
import { processSyncBatch, getChanges } from '../../../src/modules/sync/sync.service'

const task = prismaMock.task as any
const board = prismaMock.board as any
const boardMember = prismaMock.boardMember as any
const column = prismaMock.column as any

const mockUserId = 'user-123'
const mockBoardId = 'board-456'
const mockTaskId = '550e8400-e29b-41d4-a716-446655440000'
const mockColumnId = '660e8400-e29b-41d4-a716-446655440001'
const mockColumnId2 = '770e8400-e29b-41d4-a716-446655440002'

const mockMember = { boardId: mockBoardId, userId: mockUserId, role: 'MEMBER', joinedAt: new Date() }

const mockTask = {
  id: mockTaskId,
  title: 'Tarea',
  boardId: mockBoardId,
  columnId: mockColumnId,
  position: 0,
  version: 1,
  priority: 'MEDIUM',
  tags: [],
  assigneeId: null,
  dueDate: null,
  description: null,
  createdById: mockUserId,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockColumn = { id: mockColumnId, boardId: mockBoardId, name: 'Col', position: 0 }

beforeEach(() => {
  jest.clearAllMocks()
})

// processSyncBatch — task UPDATE

describe('processSyncBatch — task UPDATE', () => {
  const op = {
    entityType: 'task' as const,
    entityId: mockTaskId,
    operation: 'UPDATE' as const,
    payload: { title: 'Título actualizado' },
    timestamp: Date.now(),
    version: 1,
  }

  it('aplica la actualización si la versión coincide', async () => {
    const updated = { ...mockTask, title: 'Título actualizado', version: 2 }
    mockFn(task, 'findUnique').mockResolvedValue(mockTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(task, 'update').mockResolvedValue(updated)

    const results = await processSyncBatch([op], mockUserId)

    expect(results[0]).toMatchObject({ entityId: mockTaskId, status: 'applied' })
    expect(results[0].serverData).toMatchObject({ title: 'Título actualizado' })
  })

  it('devuelve conflict si la versión no coincide', async () => {
    mockFn(task, 'findUnique').mockResolvedValue({ ...mockTask, version: 5 })
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)

    const results = await processSyncBatch([op], mockUserId)

    expect(results[0]).toMatchObject({ entityId: mockTaskId, status: 'conflict' })
    expect(results[0].serverData).toMatchObject({ version: 5 })
  })

  it('devuelve skipped si la tarea no existe', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(null)

    const results = await processSyncBatch([op], mockUserId)

    expect(results[0]).toMatchObject({ status: 'skipped' })
  })

  it('devuelve error si el usuario no es miembro (excepción capturada)', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(mockTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(null)

    const results = await processSyncBatch([op], mockUserId)

    expect(results[0]).toMatchObject({ entityId: mockTaskId, status: 'error' })
  })
})

// processSyncBatch — task DELETE

describe('processSyncBatch — task DELETE', () => {
  const op = {
    entityType: 'task' as const,
    entityId: mockTaskId,
    operation: 'DELETE' as const,
    payload: {},
    timestamp: Date.now(),
    version: 1,
  }

  it('elimina la tarea y devuelve applied', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(mockTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(task, 'delete').mockResolvedValue(mockTask)

    const results = await processSyncBatch([op], mockUserId)

    expect(results[0]).toMatchObject({ status: 'applied' })
    expect(task.delete).toHaveBeenCalledWith({ where: { id: mockTaskId } })
  })

  it('devuelve skipped si la tarea no existe', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(null)

    const results = await processSyncBatch([op], mockUserId)

    expect(results[0]).toMatchObject({ status: 'skipped' })
  })
})

// processSyncBatch — task CREATE

describe('processSyncBatch — task CREATE', () => {
  const op = {
    entityType: 'task' as const,
    entityId: mockTaskId,
    operation: 'CREATE' as const,
    payload: {
      boardId: mockBoardId,
      columnId: mockColumnId,
      title: 'Nueva tarea',
      position: 0,
    },
    timestamp: Date.now(),
    version: 1,
  }

  it('crea la tarea con el ID del cliente', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(null) // no existe aún
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(column, 'findFirst').mockResolvedValue(mockColumn)
    mockFn(task, 'create').mockResolvedValue(mockTask)

    const results = await processSyncBatch([op], mockUserId)

    expect(results[0]).toMatchObject({ status: 'applied' })
    expect(task.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ id: mockTaskId }) })
    )
  })

  it('devuelve skipped si la tarea ya existe (idempotente)', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(mockTask)

    const results = await processSyncBatch([op], mockUserId)

    expect(results[0]).toMatchObject({ status: 'skipped' })
    expect(task.create).not.toHaveBeenCalled()
  })

  it('devuelve error si no se proporciona boardId', async () => {
    const noBoard = { ...op, payload: { columnId: mockColumnId, title: 'T', position: 0 } }
    mockFn(task, 'findUnique').mockResolvedValue(null)

    const results = await processSyncBatch([noBoard], mockUserId)

    expect(results[0]).toMatchObject({ status: 'error', message: 'boardId requerido' })
  })

  it('devuelve error si la columna no pertenece al board', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(null)
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(column, 'findFirst').mockResolvedValue(null)

    const results = await processSyncBatch([op], mockUserId)

    expect(results[0]).toMatchObject({ status: 'error' })
  })
})

// processSyncBatch — task MOVE

describe('processSyncBatch — task MOVE', () => {
  const op = {
    entityType: 'task' as const,
    entityId: mockTaskId,
    operation: 'MOVE' as const,
    payload: { columnId: mockColumnId2, position: 1 },
    timestamp: Date.now(),
    version: 1,
  }

  it('mueve la tarea a otra columna y devuelve applied', async () => {
    const movedTask = { ...mockTask, columnId: mockColumnId2, position: 1 }
    mockFn(task, 'findUnique')
      .mockResolvedValueOnce(mockTask)
      .mockResolvedValueOnce(movedTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(column, 'findFirst').mockResolvedValue({ ...mockColumn, id: mockColumnId2 })
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      const tx = {
        task: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          update: jest.fn().mockResolvedValue(movedTask),
        },
      }
      return cb(tx)
    })

    const results = await processSyncBatch([op], mockUserId)

    expect(results[0]).toMatchObject({ status: 'applied' })
  })

  it('devuelve error si la columna destino no existe', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(mockTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(column, 'findFirst').mockResolvedValue(null)

    const results = await processSyncBatch([op], mockUserId)

    expect(results[0]).toMatchObject({ status: 'error', message: 'Columna destino no encontrada' })
  })

  it('devuelve skipped si la tarea no existe', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(null)

    const results = await processSyncBatch([op], mockUserId)

    expect(results[0]).toMatchObject({ status: 'skipped' })
  })
})

// processSyncBatch — board UPDATE

describe('processSyncBatch — board UPDATE', () => {
  const mockBoardRecord = { id: mockBoardId, name: 'Board', color: '#fff', ownerId: mockUserId }
  const op = {
    entityType: 'board' as const,
    entityId: mockBoardId,
    operation: 'UPDATE' as const,
    payload: { name: 'Nuevo Nombre' },
    timestamp: Date.now(),
    version: 1,
  }

  it('actualiza el tablero y devuelve applied', async () => {
    const updated = { ...mockBoardRecord, name: 'Nuevo Nombre' }
    mockFn(board, 'findUnique').mockResolvedValue(mockBoardRecord)
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(board, 'update').mockResolvedValue(updated)

    const results = await processSyncBatch([op], mockUserId)

    expect(results[0]).toMatchObject({ status: 'applied' })
    expect(results[0].serverData).toMatchObject({ name: 'Nuevo Nombre' })
  })

  it('devuelve skipped si el tablero no existe', async () => {
    mockFn(board, 'findUnique').mockResolvedValue(null)

    const results = await processSyncBatch([op], mockUserId)

    expect(results[0]).toMatchObject({ status: 'skipped' })
  })
})

// processSyncBatch — entityType no soportado

describe('processSyncBatch — entityType desconocido', () => {
  it('devuelve skipped para tipos no soportados', async () => {
    const op = {
      entityType: 'column' as const,
      entityId: mockColumnId,
      operation: 'UPDATE' as const,
      payload: {},
      timestamp: Date.now(),
      version: 1,
    }

    const results = await processSyncBatch([op], mockUserId)

    expect(results[0]).toMatchObject({ status: 'skipped' })
  })
})

// processSyncBatch — orden FIFO

describe('processSyncBatch — ordenamiento por timestamp', () => {
  it('procesa las operaciones en orden FIFO por timestamp', async () => {
    const callOrder: number[] = []
    const op1 = {
      entityType: 'task' as const,
      entityId: mockTaskId,
      operation: 'UPDATE' as const,
      payload: { title: 'Primero' },
      timestamp: 2000,
      version: 1,
    }
    const op2 = {
      ...op1,
      payload: { title: 'Segundo' },
      timestamp: 1000,
    }

    mockFn(task, 'findUnique').mockImplementation(async () => {
      callOrder.push(Date.now())
      return mockTask
    })
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(task, 'update').mockResolvedValue(mockTask)

    // Enviamos op1 (timestamp 2000) antes que op2 (timestamp 1000)
    await processSyncBatch([op1, op2], mockUserId)

    // Ambas deben procesarse sin error
    expect(task.findUnique).toHaveBeenCalledTimes(2)
    // La primera llamada de update debe ser con el payload del op2 (timestamp menor)
    expect(task.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: expect.objectContaining({ title: 'Segundo' }) })
    )
  })
})

// getChanges

describe('getChanges', () => {
  it('devuelve boards, columns y tasks actualizados desde el timestamp', async () => {
    mockFn(boardMember, 'findMany').mockResolvedValue([{ boardId: mockBoardId }])
    mockFn(board, 'findMany').mockResolvedValue([{ id: mockBoardId }])
    mockFn(column, 'findMany').mockResolvedValue([])
    mockFn(task, 'findMany').mockResolvedValue([mockTask])

    const result = await getChanges(mockUserId, 0)

    expect(result).toMatchObject({
      boards: [{ id: mockBoardId }],
      columns: [],
      tasks: [expect.objectContaining({ id: mockTaskId })],
    })
    expect(result.timestamp).toBeGreaterThan(0)
  })

  it('devuelve arrays vacíos si el usuario no tiene membresías', async () => {
    mockFn(boardMember, 'findMany').mockResolvedValue([])

    const result = await getChanges(mockUserId, 0)

    expect(result).toMatchObject({ boards: [], columns: [], tasks: [] })
  })
})