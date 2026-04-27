import { createBoardSchema, updateBoardSchema } from '../../../src/modules/boards/boards.validation'

describe('createBoardSchema', () => {
  const valid = { name: 'Mi Tablero', description: 'Descripción', color: '#6366F1' }

  it('acepta datos válidos', () => {
    const result = createBoardSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('usa #6366F1 como color por defecto', () => {
    const result = createBoardSchema.safeParse({ name: 'Mi Tablero' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.color).toBe('#6366F1')
  })

  it('falla si name está vacío', () => {
    const result = createBoardSchema.safeParse({ ...valid, name: '' })
    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.name).toBeDefined()
  })

  it('falla si name supera 100 caracteres', () => {
    const result = createBoardSchema.safeParse({ ...valid, name: 'A'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('falla si description supera 500 caracteres', () => {
    const result = createBoardSchema.safeParse({ ...valid, description: 'A'.repeat(501) })
    expect(result.success).toBe(false)
  })

  it('falla si color no tiene formato hex válido', () => {
    const result = createBoardSchema.safeParse({ ...valid, color: 'rojo' })
    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.color).toBeDefined()
  })

  it('falla si color tiene formato hex incompleto', () => {
    const result = createBoardSchema.safeParse({ ...valid, color: '#FFF' })
    expect(result.success).toBe(false)
  })

  it('acepta description como opcional', () => {
    const result = createBoardSchema.safeParse({ name: 'Mi Tablero', color: '#AABBCC' })
    expect(result.success).toBe(true)
  })

  it('falla si faltan campos requeridos', () => {
    const result = createBoardSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('updateBoardSchema', () => {
  it('acepta un objeto vacío (todos los campos son opcionales)', () => {
    const result = updateBoardSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('acepta actualizar solo el name', () => {
    const result = updateBoardSchema.safeParse({ name: 'Nuevo Nombre' })
    expect(result.success).toBe(true)
  })

  it('acepta description como null', () => {
    const result = updateBoardSchema.safeParse({ description: null })
    expect(result.success).toBe(true)
  })

  it('acepta actualizar solo el color', () => {
    const result = updateBoardSchema.safeParse({ color: '#FF5733' })
    expect(result.success).toBe(true)
  })

  it('falla si name está vacío', () => {
    const result = updateBoardSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('falla si name supera 100 caracteres', () => {
    const result = updateBoardSchema.safeParse({ name: 'A'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('falla si color tiene formato inválido', () => {
    const result = updateBoardSchema.safeParse({ color: '#GGGGGG' })
    expect(result.success).toBe(false)
  })

  it('falla si description supera 500 caracteres', () => {
    const result = updateBoardSchema.safeParse({ description: 'B'.repeat(501) })
    expect(result.success).toBe(false)
  })
})