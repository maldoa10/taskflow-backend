import { prismaMock, mockFn } from '../../__mocks__/prisma'
import * as tasksService from '../../../src/modules/tasks/tasks.service'
import { sendPushToUser } from '../../../src/modules/push/push.service'

jest.mock('../../../src/modules/push/push.service', () => ({
  sendPushToUser: jest.fn(),
}))

const boardMember = prismaMock.boardMember as any
const task = prismaMock.task as any
const column = prismaMock.column as any

const mockUserId = 'user-123'
const mockAssigneeId = 'user-789'
const mockBoardId = 'board-456'
const mockTaskId = 'task-789'
const mockColumnId = 'col-111'
const mockColumnId2 = 'col-222'

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

const mockTaskWithRelations = {
  ...mockTask,
  board: { name: 'Mi Tablero Orgánico' },
  column: { name: 'Por Hacer' },
}

beforeEach(() => {
  jest.clearAllMocks()
})

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

describe('tasksService.createTask', () => {
  const input = {
    columnId: mockColumnId,
    title: 'Nueva Tarea',
    priority: 'MEDIUM' as const,
    tags: [],
  }

  it('crea una tarea al final de la columna y no envía push si no hay assignee', async () => {
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(column, 'findFirst').mockResolvedValue(mockColumn)
    mockFn(task, 'findFirst').mockResolvedValue(null)
    mockFn(task, 'create').mockResolvedValue(mockTaskWithRelations)

    const result = await tasksService.createTask(mockBoardId, mockUserId, input)

    expect(task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ position: 0, boardId: mockBoardId }),
        include: { board: { select: { name: true } } },
      })
    )
    expect(result).not.toHaveProperty('board')
    expect(sendPushToUser).not.toHaveBeenCalled()
  })

  it('envía notificación push si la tarea se asigna a otro usuario', async () => {
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(column, 'findFirst').mockResolvedValue(mockColumn)
    mockFn(task, 'findFirst').mockResolvedValue(null)

    const inputWithAssignee = { ...input, assigneeId: mockAssigneeId }
    mockFn(task, 'create').mockResolvedValue({
      ...mockTaskWithRelations,
      assigneeId: mockAssigneeId
    })

    await tasksService.createTask(mockBoardId, mockUserId, inputWithAssignee)

    expect(sendPushToUser).toHaveBeenCalledWith(mockAssigneeId, expect.objectContaining({
      title: 'Te asignaron una tarea',
      body: expect.stringContaining('Mi Tarea'),
    }))
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
})

describe('tasksService.updateTask', () => {
  const input = { title: 'Tarea Actualizada' }

  it('actualiza la tarea y limpia el retorno del objeto board', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(mockTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(task, 'update').mockResolvedValue(mockTaskWithRelations)

    const result = await tasksService.updateTask(mockTaskId, mockUserId, input)

    expect(task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockTaskId },
        include: { board: { select: { name: true } } }
      })
    )
    expect(result).not.toHaveProperty('board')
    expect(sendPushToUser).not.toHaveBeenCalled()
  })

  it('envía push si el asignado cambió y es distinto al usuario que edita', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(mockTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(task, 'update').mockResolvedValue({
      ...mockTaskWithRelations,
      assigneeId: mockAssigneeId
    })

    await tasksService.updateTask(mockTaskId, mockUserId, { assigneeId: mockAssigneeId })

    expect(sendPushToUser).toHaveBeenCalledWith(mockAssigneeId, expect.objectContaining({
      title: 'Te asignaron una tarea',
    }))
  })

  it('lanza NOT_FOUND si la tarea no existe', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(null)

    await expect(tasksService.updateTask(mockTaskId, mockUserId, input)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    })
  })
})

describe('tasksService.deleteTask', () => {
  it('elimina la tarea si el usuario es miembro del board', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(mockTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(task, 'delete').mockResolvedValue(mockTask)

    await tasksService.deleteTask(mockTaskId, mockUserId)

    expect(task.delete).toHaveBeenCalledWith({ where: { id: mockTaskId } })
  })
})

describe('tasksService.moveTask', () => {
  const moveInput = { columnId: mockColumnId2, position: 1 }

  it('mueve la tarea a otra columna y envía push al asignado si corresponde', async () => {
    const initialTask = { ...mockTaskWithRelations, assigneeId: mockAssigneeId }
    const destinationColumn = { ...mockColumn, id: mockColumnId2, name: 'En Progreso' }
    const finalMovedTask = { ...mockTask, columnId: mockColumnId2, position: 1 }

    mockFn(task, 'findUnique')
      .mockResolvedValueOnce(initialTask)
      .mockResolvedValueOnce(finalMovedTask)

    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(column, 'findFirst').mockResolvedValue(destinationColumn)

      ; (prismaMock.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
        const tx = {
          task: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            update: jest.fn().mockResolvedValue(finalMovedTask),
          },
        }
        return cb(tx)
      })

    const result = await tasksService.moveTask(mockTaskId, mockUserId, moveInput)

    expect(sendPushToUser).toHaveBeenCalledWith(mockAssigneeId, expect.objectContaining({
      title: 'Tarea movida',
      body: expect.stringContaining('"En Progreso"'),
    }))
    expect(result).toMatchObject({ columnId: mockColumnId2, position: 1 })
  })

  it('lanza NOT_FOUND si la columna destino no existe en el board', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(mockTaskWithRelations)
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    mockFn(column, 'findFirst').mockResolvedValue(null)

    await expect(tasksService.moveTask(mockTaskId, mockUserId, moveInput)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    })
  })
})