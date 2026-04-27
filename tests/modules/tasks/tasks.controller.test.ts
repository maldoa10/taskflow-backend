import { Request, Response, NextFunction } from 'express'
import * as tasksService from '../../../src/modules/tasks/tasks.service'
import {
  getBoardTasks,
  createTask,
  updateTask,
  deleteTask,
  moveTask,
} from '../../../src/modules/tasks/tasks.controller'
import { AppError } from '../../../src/middleware/errorHandler'

jest.mock('../../../src/modules/tasks/tasks.service')

const mockTasksService = tasksService as jest.Mocked<typeof tasksService>

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

const validUUID = '550e8400-e29b-41d4-a716-446655440000'

const mockTask = {
  id: 'task-789',
  title: 'Mi Tarea',
  columnId: validUUID,
  boardId: 'board-456',
  priority: 'MEDIUM',
  position: 0,
  tags: [],
}

// getBoardTasks

describe('getBoardTasks controller', () => {
  it('responde con las tareas del board', async () => {
    mockTasksService.getBoardTasks.mockResolvedValue([mockTask] as any)
    const req = makeReq({}, { boardId: 'board-456' })
    const res = makeRes()

    await getBoardTasks(req as Request, res as Response, next)

    expect(mockTasksService.getBoardTasks).toHaveBeenCalledWith('board-456', 'user-123')
    expect(res.json).toHaveBeenCalledWith({ tasks: [mockTask] })
    expect(next).not.toHaveBeenCalled()
  })

  it('llama next con FORBIDDEN si el usuario no es miembro', async () => {
    mockTasksService.getBoardTasks.mockRejectedValue(new AppError('FORBIDDEN', 'Sin acceso', 403))
    const req = makeReq({}, { boardId: 'board-456' })
    const res = makeRes()

    await getBoardTasks(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }))
  })
})

// createTask

describe('createTask controller', () => {
  const validBody = { columnId: validUUID, title: 'Nueva Tarea' }

  it('responde 201 con la tarea creada en datos válidos', async () => {
    mockTasksService.createTask.mockResolvedValue(mockTask as any)
    const req = makeReq(validBody, { boardId: 'board-456' })
    const res = makeRes()

    await createTask(req as Request, res as Response, next)

    expect(mockTasksService.createTask).toHaveBeenCalledWith(
      'board-456',
      'user-123',
      expect.objectContaining({ title: 'Nueva Tarea' })
    )
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ task: mockTask })
    expect(next).not.toHaveBeenCalled()
  })

  it('llama next con VALIDATION_ERROR si columnId no es UUID', async () => {
    const req = makeReq({ columnId: 'no-es-uuid', title: 'Tarea' }, { boardId: 'board-456' })
    const res = makeRes()

    await createTask(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR' })
    )
    expect(mockTasksService.createTask).not.toHaveBeenCalled()
  })

  it('llama next con VALIDATION_ERROR si title está vacío', async () => {
    const req = makeReq({ columnId: validUUID, title: '' }, { boardId: 'board-456' })
    const res = makeRes()

    await createTask(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR' })
    )
  })

  it('llama next si el servicio falla', async () => {
    mockTasksService.createTask.mockRejectedValue(new AppError('NOT_FOUND', 'Columna no encontrada', 404))
    const req = makeReq(validBody, { boardId: 'board-456' })
    const res = makeRes()

    await createTask(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }))
  })
})

// updateTask

describe('updateTask controller', () => {
  const validBody = { title: 'Tarea Actualizada' }

  it('responde con la tarea actualizada', async () => {
    const updated = { ...mockTask, title: 'Tarea Actualizada' }
    mockTasksService.updateTask.mockResolvedValue(updated as any)
    const req = makeReq(validBody, { id: 'task-789' })
    const res = makeRes()

    await updateTask(req as Request, res as Response, next)

    expect(mockTasksService.updateTask).toHaveBeenCalledWith(
      'task-789',
      'user-123',
      expect.objectContaining({ title: 'Tarea Actualizada' })
    )
    expect(res.json).toHaveBeenCalledWith({ task: updated })
    expect(next).not.toHaveBeenCalled()
  })

  it('llama next con VALIDATION_ERROR si priority es inválido', async () => {
    const req = makeReq({ priority: 'CRITICAL' }, { id: 'task-789' })
    const res = makeRes()

    await updateTask(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR' })
    )
    expect(mockTasksService.updateTask).not.toHaveBeenCalled()
  })

  it('llama next con NOT_FOUND si la tarea no existe', async () => {
    mockTasksService.updateTask.mockRejectedValue(new AppError('NOT_FOUND', 'No encontrado', 404))
    const req = makeReq(validBody, { id: 'no-existe' })
    const res = makeRes()

    await updateTask(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }))
  })

  it('llama next con FORBIDDEN si el usuario no es miembro', async () => {
    mockTasksService.updateTask.mockRejectedValue(new AppError('FORBIDDEN', 'Sin acceso', 403))
    const req = makeReq(validBody, { id: 'task-789' })
    const res = makeRes()

    await updateTask(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }))
  })
})

// deleteTask

describe('deleteTask controller', () => {
  it('responde 204 al eliminar la tarea', async () => {
    mockTasksService.deleteTask.mockResolvedValue(undefined)
    const req = makeReq({}, { id: 'task-789' })
    const res = makeRes()

    await deleteTask(req as Request, res as Response, next)

    expect(mockTasksService.deleteTask).toHaveBeenCalledWith('task-789', 'user-123')
    expect(res.status).toHaveBeenCalledWith(204)
    expect(res.send).toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  it('llama next con NOT_FOUND si la tarea no existe', async () => {
    mockTasksService.deleteTask.mockRejectedValue(new AppError('NOT_FOUND', 'No encontrado', 404))
    const req = makeReq({}, { id: 'no-existe' })
    const res = makeRes()

    await deleteTask(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }))
  })

  it('llama next con FORBIDDEN si el usuario no es miembro', async () => {
    mockTasksService.deleteTask.mockRejectedValue(new AppError('FORBIDDEN', 'Sin acceso', 403))
    const req = makeReq({}, { id: 'task-789' })
    const res = makeRes()

    await deleteTask(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }))
  })
})

// moveTask

describe('moveTask controller', () => {
  const validBody = { columnId: validUUID, position: 2 }

  it('responde con la tarea movida', async () => {
    const moved = { ...mockTask, columnId: validUUID, position: 2 }
    mockTasksService.moveTask.mockResolvedValue(moved as any)
    const req = makeReq(validBody, { id: 'task-789' })
    const res = makeRes()

    await moveTask(req as Request, res as Response, next)

    expect(mockTasksService.moveTask).toHaveBeenCalledWith(
      'task-789',
      'user-123',
      expect.objectContaining({ columnId: validUUID, position: 2 })
    )
    expect(res.json).toHaveBeenCalledWith({ task: moved })
    expect(next).not.toHaveBeenCalled()
  })

  it('llama next con VALIDATION_ERROR si columnId no es UUID', async () => {
    const req = makeReq({ columnId: 'no-es-uuid', position: 0 }, { id: 'task-789' })
    const res = makeRes()

    await moveTask(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR' })
    )
    expect(mockTasksService.moveTask).not.toHaveBeenCalled()
  })

  it('llama next con VALIDATION_ERROR si position es negativo', async () => {
    const req = makeReq({ columnId: validUUID, position: -1 }, { id: 'task-789' })
    const res = makeRes()

    await moveTask(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR' })
    )
  })

  it('llama next con NOT_FOUND si la columna destino no existe', async () => {
    mockTasksService.moveTask.mockRejectedValue(new AppError('NOT_FOUND', 'Columna no encontrada', 404))
    const req = makeReq(validBody, { id: 'task-789' })
    const res = makeRes()

    await moveTask(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }))
  })

  it('llama next con FORBIDDEN si el usuario no es miembro', async () => {
    mockTasksService.moveTask.mockRejectedValue(new AppError('FORBIDDEN', 'Sin acceso', 403))
    const req = makeReq(validBody, { id: 'task-789' })
    const res = makeRes()

    await moveTask(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }))
  })
})