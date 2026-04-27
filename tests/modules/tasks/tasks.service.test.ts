import { prismaMock, mockFn } from '../../__mocks__/prisma'
import * as tasksService from '../../../src/modules/tasks/tasks.service'

const boardMember = prismaMock.boardMember as any
const task = prismaMock.task as any
const column = prismaMock.column as any

const mockUserId = 'user-123'
const mockBoardId = 'board-456'
const mockTaskId = 'task-789'
const mockColumnId = 'col-111'
const mockColumnId2 = 'col-222'
const validUUID = '550e8400-e29b-41d4-a716-446655440000'

const mockMember = {
  boardId: mockBoardId,
  userId: mockUserId,
  role: 'MEMBER',
  joinedAt: new Date(),
}

const mockColumn = {
  id: mockColumnId,
  name: 'Por Hacer',
  boardId: mockBoardId,
  position: 0,
}

const mockTask = {
  id: mockTaskId,
  title: 'Mi Tarea',
  description: null,
  priority: 'MEDIUM',
  columnId: mockColumnId,
  boardId: mockBoardId,
  createdById: mockUserId,
  assigneeId: null,
  dueDate: null,
  tags: [],
  position: 0,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
}

beforeEach(() => {
  jest.clearAllMocks()
})

// getBoardTasks

describe('tasksService.getBoardTasks', () => {
  it('devuelve las tareas del board si el usuario es miembro', async () => {
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(task, 'findMany').mockResolvedValue([mockTask])

    const result = await tasksService.getBoardTasks(mockBoardId, mockUserId)

    expect(task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { boardId: mockBoardId } })
    )
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: mockTaskId })
  })

  it('lanza FORBIDDEN si el usuario no es miembro', async () => {
    mockFn(boardMember, 'findUnique').mockResolvedValue(null)

    await expect(tasksService.getBoardTasks(mockBoardId, mockUserId)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    })
  })
})

// createTask

describe('tasksService.createTask', () => {
  const input = {
    columnId: mockColumnId,
    title: 'Nueva Tarea',
    priority: 'MEDIUM' as const,
    tags: [],
  }

  it('crea una tarea al final de la columna', async () => {
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(column, 'findFirst').mockResolvedValue(mockColumn)
    mockFn(task, 'findFirst').mockResolvedValue(null) // no hay tareas previas → position = 0
    mockFn(task, 'create').mockResolvedValue({ ...mockTask, position: 0 })

    const result = await tasksService.createTask(mockBoardId, mockUserId, input)

    expect(task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ position: 0, boardId: mockBoardId }),
      })
    )
    expect(result).toMatchObject({ id: mockTaskId, position: 0 })
  })

  it('calcula position = lastTask.position + 1 si ya hay tareas', async () => {
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(column, 'findFirst').mockResolvedValue(mockColumn)
    mockFn(task, 'findFirst').mockResolvedValue({ ...mockTask, position: 2 })
    mockFn(task, 'create').mockResolvedValue({ ...mockTask, position: 3 })

    const result = await tasksService.createTask(mockBoardId, mockUserId, input)

    expect(task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ position: 3 }),
      })
    )
    expect(result.position).toBe(3)
  })

  it('lanza FORBIDDEN si el usuario no es miembro', async () => {
    mockFn(boardMember, 'findUnique').mockResolvedValue(null)

    await expect(tasksService.createTask(mockBoardId, mockUserId, input)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    })
  })

  it('lanza NOT_FOUND si la columna no pertenece al board', async () => {
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(column, 'findFirst').mockResolvedValue(null)

    await expect(tasksService.createTask(mockBoardId, mockUserId, input)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    })
  })

  it('convierte dueDate string a Date', async () => {
    const dueDate = new Date('2025-12-31')
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(column, 'findFirst').mockResolvedValue(mockColumn)
    mockFn(task, 'findFirst').mockResolvedValue(null)
    mockFn(task, 'create').mockResolvedValue({ ...mockTask, dueDate })

    await tasksService.createTask(mockBoardId, mockUserId, { ...input, dueDate })

    expect(task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dueDate: expect.any(Date) }),
      })
    )
  })
})

// updateTask

describe('tasksService.updateTask', () => {
  const input = { title: 'Tarea Actualizada' }

  it('actualiza la tarea si el usuario es miembro del board', async () => {
    const updated = { ...mockTask, title: 'Tarea Actualizada', version: 2 }
    mockFn(task, 'findUnique').mockResolvedValue(mockTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(task, 'update').mockResolvedValue(updated)

    const result = await tasksService.updateTask(mockTaskId, mockUserId, input)

    expect(task.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: mockTaskId } })
    )
    expect(result).toMatchObject({ title: 'Tarea Actualizada' })
  })

  it('lanza NOT_FOUND si la tarea no existe', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(null)

    await expect(tasksService.updateTask(mockTaskId, mockUserId, input)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    })
  })

  it('lanza FORBIDDEN si el usuario no es miembro del board', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(mockTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(null)

    await expect(tasksService.updateTask(mockTaskId, mockUserId, input)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    })
  })

  it('convierte dueDate a Date si se proporciona', async () => {
    const dueDate = new Date('2025-06-30')
    mockFn(task, 'findUnique').mockResolvedValue(mockTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(task, 'update').mockResolvedValue({ ...mockTask, dueDate })

    await tasksService.updateTask(mockTaskId, mockUserId, { dueDate })

    expect(task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dueDate: expect.any(Date) }),
      })
    )
  })

  it('pone dueDate a null si se pasa null', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(mockTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(task, 'update').mockResolvedValue({ ...mockTask, dueDate: null })

    await tasksService.updateTask(mockTaskId, mockUserId, { dueDate: null })

    expect(task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dueDate: null }),
      })
    )
  })
})

// deleteTask

describe('tasksService.deleteTask', () => {
  it('elimina la tarea si el usuario es miembro del board', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(mockTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(task, 'delete').mockResolvedValue(mockTask)

    await tasksService.deleteTask(mockTaskId, mockUserId)

    expect(task.delete).toHaveBeenCalledWith({ where: { id: mockTaskId } })
  })

  it('lanza NOT_FOUND si la tarea no existe', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(null)

    await expect(tasksService.deleteTask(mockTaskId, mockUserId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    })
  })

  it('lanza FORBIDDEN si el usuario no es miembro del board', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(mockTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(null)

    await expect(tasksService.deleteTask(mockTaskId, mockUserId)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    })
  })
})

// moveTask

describe('tasksService.moveTask', () => {
  const moveInput = { columnId: mockColumnId2, position: 1 }

  it('mueve la tarea a otra columna correctamente', async () => {
    const movedTask = { ...mockTask, columnId: mockColumnId2, position: 1 }
    mockFn(task, 'findUnique')
      .mockResolvedValueOnce(mockTask)   // primera llamada: encontrar la tarea
      .mockResolvedValueOnce(movedTask)  // segunda llamada: findUnique final
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(column, 'findFirst').mockResolvedValue({ ...mockColumn, id: mockColumnId2 })
      ; (prismaMock.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
        const tx = {
          task: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            update: jest.fn().mockResolvedValue(movedTask),
          },
        }
        return cb(tx)
      })

    const result = await tasksService.moveTask(mockTaskId, mockUserId, moveInput)

    expect(result).toMatchObject({ columnId: mockColumnId2, position: 1 })
  })

  it('reordena en la misma columna (mover hacia adelante)', async () => {
    const sameColumnTask = { ...mockTask, columnId: mockColumnId, position: 0 }
    const movedTask = { ...mockTask, columnId: mockColumnId, position: 3 }
    const sameColInput = { columnId: mockColumnId, position: 3 }

    mockFn(task, 'findUnique')
      .mockResolvedValueOnce(sameColumnTask)
      .mockResolvedValueOnce(movedTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(column, 'findFirst').mockResolvedValue(mockColumn)
      ; (prismaMock.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
        const tx = {
          task: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            update: jest.fn().mockResolvedValue(movedTask),
          },
        }
        return cb(tx)
      })

    const result = await tasksService.moveTask(mockTaskId, mockUserId, sameColInput)
    expect(result).toMatchObject({ position: 3 })
  })

  it('reordena en la misma columna (mover hacia atrás)', async () => {
    const sameColumnTask = { ...mockTask, columnId: mockColumnId, position: 3 }
    const movedTask = { ...mockTask, columnId: mockColumnId, position: 1 }
    const sameColInput = { columnId: mockColumnId, position: 1 }

    mockFn(task, 'findUnique')
      .mockResolvedValueOnce(sameColumnTask)
      .mockResolvedValueOnce(movedTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(column, 'findFirst').mockResolvedValue(mockColumn)
      ; (prismaMock.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
        const tx = {
          task: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            update: jest.fn().mockResolvedValue(movedTask),
          },
        }
        return cb(tx)
      })

    const result = await tasksService.moveTask(mockTaskId, mockUserId, sameColInput)
    expect(result).toMatchObject({ position: 1 })
  })

  it('lanza NOT_FOUND si la tarea no existe', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(null)

    await expect(tasksService.moveTask(mockTaskId, mockUserId, moveInput)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    })
  })

  it('lanza FORBIDDEN si el usuario no es miembro del board', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(mockTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(null)

    await expect(tasksService.moveTask(mockTaskId, mockUserId, moveInput)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    })
  })

  it('lanza NOT_FOUND si la columna destino no existe en el board', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(mockTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(column, 'findFirst').mockResolvedValue(null)

    await expect(tasksService.moveTask(mockTaskId, mockUserId, moveInput)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    })
  })
})