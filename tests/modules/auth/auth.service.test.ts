import bcrypt from 'bcryptjs'
import { prismaMock, mockFn } from '../../__mocks__/prisma'
import * as authService from '../../../src/modules/auth/auth.service'

const user = prismaMock.user as any

const mockUser = {
  id: 'user-123',
  name: 'Juan Pérez',
  email: 'juan@example.com',
  passwordHash: '',
  avatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

beforeAll(async () => {
  mockUser.passwordHash = await bcrypt.hash('password123', 12)
})

// Register

describe('authService.register', () => {
  const input = { name: 'Juan Pérez', email: 'juan@example.com', password: 'password123' }

  it('registra un usuario nuevo y devuelve tokens', async () => {
    mockFn(user, 'findUnique').mockResolvedValue(null)
    mockFn(user, 'create').mockResolvedValue(mockUser)

    const result = await authService.register(input)

    expect(result.user).toMatchObject({ id: mockUser.id, email: mockUser.email })
    expect(result.accessToken).toBeDefined()
    expect(result.refreshToken).toBeDefined()
  })

  it('lanza CONFLICT si el email ya existe', async () => {
    mockFn(user, 'findUnique').mockResolvedValue(mockUser)

    await expect(authService.register(input)).rejects.toMatchObject({
      code: 'CONFLICT',
      statusCode: 409,
    })
  })
})

// Login

describe('authService.login', () => {
  const input = { email: 'juan@example.com', password: 'password123', remember: false }

  it('hace login con credenciales válidas y devuelve tokens', async () => {
    mockFn(user, 'findUnique').mockResolvedValue(mockUser)

    const result = await authService.login(input)

    expect(result.user).not.toHaveProperty('passwordHash')
    expect(result.accessToken).toBeDefined()
    expect(result.refreshToken).toBeDefined()
  })

  it('lanza UNAUTHORIZED si el usuario no existe', async () => {
    mockFn(user, 'findUnique').mockResolvedValue(null)

    await expect(authService.login(input)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    })
  })

  it('lanza UNAUTHORIZED si la contraseña es incorrecta', async () => {
    mockFn(user, 'findUnique').mockResolvedValue(mockUser)

    await expect(
      authService.login({ ...input, password: 'wrongpassword' })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('usa expiración extendida si remember es true', async () => {
    mockFn(user, 'findUnique').mockResolvedValue(mockUser)

    const result = await authService.login({ ...input, remember: true })
    expect(result.refreshToken).toBeDefined()
  })
})

// getMe

describe('authService.getMe', () => {
  it('devuelve el usuario si existe', async () => {
    mockFn(user, 'findUnique').mockResolvedValue(mockUser)

    const result = await authService.getMe('user-123')
    expect(result).toMatchObject({ id: 'user-123', email: mockUser.email })
  })

  it('lanza NOT_FOUND si el usuario no existe', async () => {
    mockFn(user, 'findUnique').mockResolvedValue(null)

    await expect(authService.getMe('no-existe')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    })
  })
})

// verifyAccessToken

describe('authService.verifyAccessToken', () => {
  it('verifica un token válido', async () => {
    mockFn(user, 'findUnique').mockResolvedValue(null)
    mockFn(user, 'create').mockResolvedValue(mockUser)

    const { accessToken } = await authService.register({
      name: mockUser.name,
      email: mockUser.email,
      password: 'password123',
    })

    const payload = authService.verifyAccessToken(accessToken)
    expect(payload.sub).toBe(mockUser.id)
    expect(payload.email).toBe(mockUser.email)
  })

  it('lanza UNAUTHORIZED con un token inválido', () => {
    expect(() => authService.verifyAccessToken('token.invalido')).toThrow(
      expect.objectContaining({ code: 'UNAUTHORIZED' })
    )
  })
})

// refreshTokens

describe('authService.refreshTokens', () => {
  let validRefreshToken: string

  beforeEach(async () => {
    mockFn(user, 'findUnique').mockResolvedValue(null)
    mockFn(user, 'create').mockResolvedValue(mockUser)

    const { refreshToken } = await authService.register({
      name: mockUser.name,
      email: mockUser.email,
      password: 'password123',
    })
    validRefreshToken = refreshToken
  })

  it('rota los tokens con un refresh token válido', async () => {
    mockFn(user, 'findUnique').mockResolvedValue(mockUser)

    const result = await authService.refreshTokens(validRefreshToken)
    expect(result.accessToken).toBeDefined()
    expect(result.refreshToken).toBeDefined()
  })

  it('lanza UNAUTHORIZED si el refresh token es inválido', async () => {
    await expect(authService.refreshTokens('token.invalido')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })

  it('lanza UNAUTHORIZED si el usuario ya no existe en DB', async () => {
    mockFn(user, 'findUnique').mockResolvedValue(null)

    await expect(authService.refreshTokens(validRefreshToken)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })
})