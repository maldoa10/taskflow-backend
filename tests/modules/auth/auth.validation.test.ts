import { registerSchema, loginSchema, refreshSchema } from '../../../src/modules/auth/auth.validation'

describe('registerSchema', () => {
  const valid = { name: 'Juan Pérez', email: 'juan@example.com', password: 'password123' }

  it('acepta datos válidos', () => {
    const result = registerSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('falla si name tiene menos de 2 caracteres', () => {
    const result = registerSchema.safeParse({ ...valid, name: 'A' })
    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.name).toBeDefined()
  })

  it('falla si name supera 100 caracteres', () => {
    const result = registerSchema.safeParse({ ...valid, name: 'A'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('falla si email es inválido', () => {
    const result = registerSchema.safeParse({ ...valid, email: 'no-es-email' })
    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.email).toBeDefined()
  })

  it('falla si password tiene menos de 8 caracteres', () => {
    const result = registerSchema.safeParse({ ...valid, password: 'short' })
    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.password).toBeDefined()
  })

  it('falla si password supera 72 caracteres', () => {
    const result = registerSchema.safeParse({ ...valid, password: 'A'.repeat(73) })
    expect(result.success).toBe(false)
  })

  it('falla si faltan campos requeridos', () => {
    const result = registerSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('loginSchema', () => {
  const valid = { email: 'juan@example.com', password: 'password123' }

  it('acepta datos válidos sin remember', () => {
    const result = loginSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.remember).toBe(false)
  })

  it('acepta remember: true', () => {
    const result = loginSchema.safeParse({ ...valid, remember: true })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.remember).toBe(true)
  })

  it('falla si email es inválido', () => {
    const result = loginSchema.safeParse({ ...valid, email: 'bad' })
    expect(result.success).toBe(false)
  })

  it('falla si password está vacío', () => {
    const result = loginSchema.safeParse({ ...valid, password: '' })
    expect(result.success).toBe(false)
  })
})

describe('refreshSchema', () => {
  it('acepta un refreshToken válido', () => {
    const result = refreshSchema.safeParse({ refreshToken: 'some.token.here' })
    expect(result.success).toBe(true)
  })

  it('falla si refreshToken está vacío', () => {
    const result = refreshSchema.safeParse({ refreshToken: '' })
    expect(result.success).toBe(false)
  })

  it('falla si no se envía refreshToken', () => {
    const result = refreshSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})