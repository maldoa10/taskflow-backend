import { syncOperationSchema, syncBatchSchema } from '../../../src/modules/sync/sync.validation'

const validUUID = '550e8400-e29b-41d4-a716-446655440000'

const validOperation = {
  entityType: 'task',
  entityId: validUUID,
  operation: 'UPDATE',
  payload: { title: 'Nueva tarea' },
  timestamp: Date.now(),
}

describe('syncOperationSchema', () => {
  it('acepta una operación válida', () => {
    const result = syncOperationSchema.safeParse(validOperation)
    expect(result.success).toBe(true)
  })

  it('usa 1 como versión por defecto', () => {
    const result = syncOperationSchema.safeParse(validOperation)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.version).toBe(1)
  })

  it('acepta todos los entityType válidos', () => {
    for (const entityType of ['task', 'column', 'board', 'comment']) {
      const result = syncOperationSchema.safeParse({ ...validOperation, entityType })
      expect(result.success).toBe(true)
    }
  })

  it('acepta todas las operaciones válidas', () => {
    for (const operation of ['CREATE', 'UPDATE', 'DELETE', 'MOVE']) {
      const result = syncOperationSchema.safeParse({ ...validOperation, operation })
      expect(result.success).toBe(true)
    }
  })

  it('falla si entityId no es UUID', () => {
    const result = syncOperationSchema.safeParse({ ...validOperation, entityId: 'no-uuid' })
    expect(result.success).toBe(false)
  })

  it('falla si entityType no es válido', () => {
    const result = syncOperationSchema.safeParse({ ...validOperation, entityType: 'unknown' })
    expect(result.success).toBe(false)
  })

  it('falla si operation no es válida', () => {
    const result = syncOperationSchema.safeParse({ ...validOperation, operation: 'PATCH' })
    expect(result.success).toBe(false)
  })

  it('falla si version es menor a 1', () => {
    const result = syncOperationSchema.safeParse({ ...validOperation, version: 0 })
    expect(result.success).toBe(false)
  })

  it('falla si timestamp falta', () => {
    const { timestamp, ...noTimestamp } = validOperation
    const result = syncOperationSchema.safeParse(noTimestamp)
    expect(result.success).toBe(false)
  })

  it('falla si payload falta', () => {
    const { payload, ...noPayload } = validOperation
    const result = syncOperationSchema.safeParse(noPayload)
    expect(result.success).toBe(false)
  })
})

describe('syncBatchSchema', () => {
  it('acepta un batch con una operación válida', () => {
    const result = syncBatchSchema.safeParse({ operations: [validOperation] })
    expect(result.success).toBe(true)
  })

  it('acepta un batch con múltiples operaciones', () => {
    const ops = Array(5).fill(validOperation)
    const result = syncBatchSchema.safeParse({ operations: ops })
    expect(result.success).toBe(true)
  })

  it('falla si operations está vacío', () => {
    const result = syncBatchSchema.safeParse({ operations: [] })
    expect(result.success).toBe(false)
  })

  it('falla si operations supera 100 elementos', () => {
    const ops = Array(101).fill(validOperation)
    const result = syncBatchSchema.safeParse({ operations: ops })
    expect(result.success).toBe(false)
  })

  it('falla si operations no es un array', () => {
    const result = syncBatchSchema.safeParse({ operations: validOperation })
    expect(result.success).toBe(false)
  })

  it('falla si alguna operación del batch es inválida', () => {
    const result = syncBatchSchema.safeParse({
      operations: [validOperation, { ...validOperation, entityId: 'no-uuid' }],
    })
    expect(result.success).toBe(false)
  })
})