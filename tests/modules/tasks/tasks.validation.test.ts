import { createTaskSchema, updateTaskSchema, moveTaskSchema } from '../../../src/modules/tasks/tasks.validation'

const validUUID = '550e8400-e29b-41d4-a716-446655440000'

describe('createTaskSchema', () => {
  const valid = {
    columnId: validUUID,
    title: 'Mi tarea',
  }

  it('acepta datos mínimos válidos', () => {
    const result = createTaskSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('usa MEDIUM como prioridad por defecto', () => {
    const result = createTaskSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.priority).toBe('MEDIUM')
  })

  it('usa [] como tags por defecto', () => {
    const result = createTaskSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.tags).toEqual([])
  })

  it('acepta todos los campos opcionales', () => {
    const result = createTaskSchema.safeParse({
      ...valid,
      description: 'Descripción detallada',
      priority: 'HIGH',
      dueDate: new Date().toISOString(),
      assigneeId: validUUID,
      tags: ['backend', 'urgente'],
    })
    expect(result.success).toBe(true)
  })

  it('acepta priority LOW, MEDIUM, HIGH, URGENT', () => {
    for (const priority of ['LOW', 'MEDIUM', 'HIGH', 'URGENT']) {
      const result = createTaskSchema.safeParse({ ...valid, priority })
      expect(result.success).toBe(true)
    }
  })

  it('falla si title está vacío', () => {
    const result = createTaskSchema.safeParse({ ...valid, title: '' })
    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.title).toBeDefined()
  })

  it('falla si title supera 200 caracteres', () => {
    const result = createTaskSchema.safeParse({ ...valid, title: 'A'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('falla si columnId no es UUID', () => {
    const result = createTaskSchema.safeParse({ ...valid, columnId: 'no-es-uuid' })
    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.columnId).toBeDefined()
  })

  it('falla si priority no es un valor válido', () => {
    const result = createTaskSchema.safeParse({ ...valid, priority: 'CRITICAL' })
    expect(result.success).toBe(false)
  })

  it('falla si description supera 5000 caracteres', () => {
    const result = createTaskSchema.safeParse({ ...valid, description: 'A'.repeat(5001) })
    expect(result.success).toBe(false)
  })

  it('falla si tags tiene más de 10 elementos', () => {
    const result = createTaskSchema.safeParse({ ...valid, tags: Array(11).fill('tag') })
    expect(result.success).toBe(false)
  })

  it('falla si un tag supera 30 caracteres', () => {
    const result = createTaskSchema.safeParse({ ...valid, tags: ['A'.repeat(31)] })
    expect(result.success).toBe(false)
  })

  it('falla si assigneeId no es UUID', () => {
    const result = createTaskSchema.safeParse({ ...valid, assigneeId: 'no-es-uuid' })
    expect(result.success).toBe(false)
  })

  it('acepta assigneeId como null', () => {
    const result = createTaskSchema.safeParse({ ...valid, assigneeId: null })
    expect(result.success).toBe(true)
  })
})

describe('updateTaskSchema', () => {
  it('acepta un objeto vacío (todos los campos son opcionales)', () => {
    const result = updateTaskSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('acepta actualizar solo el title', () => {
    const result = updateTaskSchema.safeParse({ title: 'Nuevo título' })
    expect(result.success).toBe(true)
  })

  it('acepta description como null', () => {
    const result = updateTaskSchema.safeParse({ description: null })
    expect(result.success).toBe(true)
  })

  it('acepta assigneeId como null', () => {
    const result = updateTaskSchema.safeParse({ assigneeId: null })
    expect(result.success).toBe(true)
  })

  it('acepta dueDate como null', () => {
    const result = updateTaskSchema.safeParse({ dueDate: null })
    expect(result.success).toBe(true)
  })

  it('acepta columnId como UUID válido', () => {
    const result = updateTaskSchema.safeParse({ columnId: validUUID })
    expect(result.success).toBe(true)
  })

  it('falla si title está vacío', () => {
    const result = updateTaskSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
  })

  it('falla si priority no es un valor válido', () => {
    const result = updateTaskSchema.safeParse({ priority: 'CRITICAL' })
    expect(result.success).toBe(false)
  })

  it('falla si columnId no es UUID', () => {
    const result = updateTaskSchema.safeParse({ columnId: 'no-es-uuid' })
    expect(result.success).toBe(false)
  })
})

describe('moveTaskSchema', () => {
  it('acepta datos válidos', () => {
    const result = moveTaskSchema.safeParse({ columnId: validUUID, position: 0 })
    expect(result.success).toBe(true)
  })

  it('acepta position mayor a 0', () => {
    const result = moveTaskSchema.safeParse({ columnId: validUUID, position: 5 })
    expect(result.success).toBe(true)
  })

  it('falla si columnId no es UUID', () => {
    const result = moveTaskSchema.safeParse({ columnId: 'no-es-uuid', position: 0 })
    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.columnId).toBeDefined()
  })

  it('falla si position es negativo', () => {
    const result = moveTaskSchema.safeParse({ columnId: validUUID, position: -1 })
    expect(result.success).toBe(false)
  })

  it('falla si position no es entero', () => {
    const result = moveTaskSchema.safeParse({ columnId: validUUID, position: 1.5 })
    expect(result.success).toBe(false)
  })

  it('falla si faltan campos requeridos', () => {
    const result = moveTaskSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})