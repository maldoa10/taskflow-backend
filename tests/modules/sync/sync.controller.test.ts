import { Request, Response, NextFunction } from 'express'
import * as syncService from '../../../src/modules/sync/sync.service'
import { syncBatch, syncChanges } from '../../../src/modules/sync/sync.controller'
import { AppError } from '../../../src/middleware/errorHandler'

jest.mock('../../../src/modules/sync/sync.service')

const mockSyncService = syncService as jest.Mocked<typeof syncService>

function makeRes(): Partial<Response> {
  const res: Partial<Response> = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

function makeReq(body = {}, query = {}, extra = {}): Partial<Request> {
  return { body, query, user: { id: 'user-123' }, ...extra } as any
}

const next = jest.fn() as jest.MockedFunction<NextFunction>

const validUUID = '550e8400-e29b-41d4-a716-446655440000'

const validOperation = {
  entityType: 'task',
  entityId: validUUID,
  operation: 'UPDATE',
  payload: { title: 'Tarea actualizada' },
  timestamp: Date.now(),
}

beforeEach(() => {
  jest.clearAllMocks()
})

// syncBatch

describe('syncBatch controller', () => {
  it('procesa el batch y devuelve los resultados', async () => {
    const results = [{ entityId: validUUID, status: 'applied' }]
    mockSyncService.processSyncBatch.mockResolvedValue(results as any)
    const req = makeReq({ operations: [validOperation] })
    const res = makeRes()

    await syncBatch(req as Request, res as Response, next)

    expect(mockSyncService.processSyncBatch).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ entityId: validUUID })]),
      'user-123'
    )
    expect(res.json).toHaveBeenCalledWith({ results })
    expect(next).not.toHaveBeenCalled()
  })

  it('llama next con VALIDATION_ERROR si operations está vacío', async () => {
    const req = makeReq({ operations: [] })
    const res = makeRes()

    await syncBatch(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }))
    expect(mockSyncService.processSyncBatch).not.toHaveBeenCalled()
  })

  it('llama next con VALIDATION_ERROR si una operación tiene entityId inválido', async () => {
    const req = makeReq({ operations: [{ ...validOperation, entityId: 'no-uuid' }] })
    const res = makeRes()

    await syncBatch(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }))
  })

  it('llama next con VALIDATION_ERROR si falta el campo operations', async () => {
    const req = makeReq({})
    const res = makeRes()

    await syncBatch(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }))
  })

  it('llama next si el servicio falla', async () => {
    mockSyncService.processSyncBatch.mockRejectedValue(new AppError('INTERNAL', 'Error', 500))
    const req = makeReq({ operations: [validOperation] })
    const res = makeRes()

    await syncBatch(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'INTERNAL' }))
  })
})

// syncChanges

describe('syncChanges controller', () => {
  const mockChanges = {
    boards: [],
    columns: [],
    tasks: [],
    timestamp: Date.now(),
  }

  it('devuelve los cambios desde el timestamp dado', async () => {
    mockSyncService.getChanges.mockResolvedValue(mockChanges)
    const req = makeReq({}, { since: '1700000000000' })
    const res = makeRes()

    await syncChanges(req as Request, res as Response, next)

    expect(mockSyncService.getChanges).toHaveBeenCalledWith('user-123', 1700000000000)
    expect(res.json).toHaveBeenCalledWith(mockChanges)
    expect(next).not.toHaveBeenCalled()
  })

  it('usa since=0 si no se proporciona el parámetro', async () => {
    mockSyncService.getChanges.mockResolvedValue(mockChanges)
    const req = makeReq({}, {})
    const res = makeRes()

    await syncChanges(req as Request, res as Response, next)

    expect(mockSyncService.getChanges).toHaveBeenCalledWith('user-123', 0)
  })

  it('llama next con VALIDATION_ERROR si since no es numérico', async () => {
    const req = makeReq({}, { since: 'no-es-numero' })
    const res = makeRes()

    await syncChanges(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }))
    expect(mockSyncService.getChanges).not.toHaveBeenCalled()
  })

  it('llama next si el servicio falla', async () => {
    mockSyncService.getChanges.mockRejectedValue(new AppError('INTERNAL', 'Error', 500))
    const req = makeReq({}, { since: '0' })
    const res = makeRes()

    await syncChanges(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'INTERNAL' }))
  })
})