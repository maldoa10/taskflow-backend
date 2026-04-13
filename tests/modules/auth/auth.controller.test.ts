import { Request, Response, NextFunction } from 'express'
import * as authService from '../../../src/modules/auth/auth.service'
import { registerHandler, loginHandler, meHandler, refreshHandler } from '../../../src/modules/auth/auth.controller'
import { AppError } from '../../../src/middleware/errorHandler'

jest.mock('../../../src/modules/auth/auth.service')

const mockAuthService = authService as jest.Mocked<typeof authService>

// Helpers

function makeRes(): Partial<Response> {
  const res: Partial<Response> = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

function makeReq(body = {}, extra = {}): Partial<Request> {
  return { body, ...extra }
}

const next = jest.fn() as jest.MockedFunction<NextFunction>

beforeEach(() => {
  jest.clearAllMocks()
})

// registerHandler

describe('registerHandler', () => {
  const validBody = { name: 'Juan', email: 'juan@example.com', password: 'password123' }
  const serviceResult = {
    user: { id: '1', name: 'Juan', email: 'juan@example.com' },
    accessToken: 'access',
    refreshToken: 'refresh',
  }

  it('responde 201 con tokens en datos válidos', async () => {
    mockAuthService.register.mockResolvedValue(serviceResult as any)
    const req = makeReq(validBody)
    const res = makeRes()

    await registerHandler(req as Request, res as Response, next)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(serviceResult)
    expect(next).not.toHaveBeenCalled()
  })

  it('llama next con VALIDATION_ERROR si el body es inválido', async () => {
    const req = makeReq({ email: 'bad', password: '123' })
    const res = makeRes()

    await registerHandler(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR' })
    )
    expect(mockAuthService.register).not.toHaveBeenCalled()
  })

  it('llama next con el error si el servicio falla', async () => {
    mockAuthService.register.mockRejectedValue(new AppError('CONFLICT', 'Email en uso', 409))
    const req = makeReq(validBody)
    const res = makeRes()

    await registerHandler(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'CONFLICT' }))
  })
})

// loginHandler

describe('loginHandler', () => {
  const validBody = { email: 'juan@example.com', password: 'password123' }
  const serviceResult = {
    user: { id: '1' },
    accessToken: 'access',
    refreshToken: 'refresh',
  }

  it('responde 200 con tokens en datos válidos', async () => {
    mockAuthService.login.mockResolvedValue(serviceResult as any)
    const req = makeReq(validBody)
    const res = makeRes()

    await loginHandler(req as Request, res as Response, next)

    expect(res.json).toHaveBeenCalledWith(serviceResult)
    expect(next).not.toHaveBeenCalled()
  })

  it('llama next con VALIDATION_ERROR si el body es inválido', async () => {
    const req = makeReq({ email: 'bad' })
    const res = makeRes()

    await loginHandler(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR' })
    )
  })

  it('llama next si el servicio lanza error', async () => {
    mockAuthService.login.mockRejectedValue(new AppError('UNAUTHORIZED', 'No autorizado', 401))
    const req = makeReq(validBody)
    const res = makeRes()

    await loginHandler(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }))
  })
})

// meHandler

describe('meHandler', () => {
  const mockUser = { id: 'user-123', name: 'Juan', email: 'juan@example.com' }

  it('devuelve el usuario autenticado', async () => {
    mockAuthService.getMe.mockResolvedValue(mockUser as any)
    const req = makeReq({}, { user: { id: 'user-123' } })
    const res = makeRes()

    await meHandler(req as Request, res as Response, next)

    expect(mockAuthService.getMe).toHaveBeenCalledWith('user-123')
    expect(res.json).toHaveBeenCalledWith({ user: mockUser })
  })

  it('llama next si el servicio falla', async () => {
    mockAuthService.getMe.mockRejectedValue(new AppError('NOT_FOUND', 'No encontrado', 404))
    const req = makeReq({}, { user: { id: 'no-existe' } })
    const res = makeRes()

    await meHandler(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }))
  })
})

// refreshHandler

describe('refreshHandler', () => {
  const validBody = { refreshToken: 'valid.refresh.token' }
  const serviceResult = { accessToken: 'new-access', refreshToken: 'new-refresh' }

  it('devuelve nuevos tokens con refresh token válido', async () => {
    mockAuthService.refreshTokens.mockResolvedValue(serviceResult)
    const req = makeReq(validBody)
    const res = makeRes()

    await refreshHandler(req as Request, res as Response, next)

    expect(mockAuthService.refreshTokens).toHaveBeenCalledWith('valid.refresh.token')
    expect(res.json).toHaveBeenCalledWith(serviceResult)
  })

  it('llama next con VALIDATION_ERROR si no viene refreshToken', async () => {
    const req = makeReq({})
    const res = makeRes()

    await refreshHandler(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR' })
    )
  })

  it('llama next si el servicio falla', async () => {
    mockAuthService.refreshTokens.mockRejectedValue(
      new AppError('UNAUTHORIZED', 'Token inválido', 401)
    )
    const req = makeReq(validBody)
    const res = makeRes()

    await refreshHandler(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }))
  })
})