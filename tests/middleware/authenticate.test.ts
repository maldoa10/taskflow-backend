import { Request, Response, NextFunction } from 'express'
import { authenticate } from '../../src/middleware/authenticate'
import * as authService from '../../src/modules/auth/auth.service'
import { AppError } from '../../src/middleware/errorHandler'

jest.mock('../../src/modules/auth/auth.service')

const mockVerify = authService.verifyAccessToken as jest.MockedFunction<
  typeof authService.verifyAccessToken
>

const next = jest.fn() as jest.MockedFunction<NextFunction>
const res = {} as Response

function makeReq(authHeader?: string): Partial<Request> {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('authenticate middleware', () => {
  it('llama next() con UNAUTHORIZED si no hay header Authorization', () => {
    authenticate(makeReq() as Request, res, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }))
  })

  it('llama next() con UNAUTHORIZED si el header no empieza con Bearer', () => {
    authenticate(makeReq('Basic sometoken') as Request, res, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }))
  })

  it('llama next() con UNAUTHORIZED si el token es inválido', () => {
    mockVerify.mockImplementation(() => {
      throw new AppError('UNAUTHORIZED', 'No autorizado', 401)
    })

    authenticate(makeReq('Bearer token.invalido') as Request, res, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }))
  })

  it('adjunta user al request y llama next() sin error si el token es válido', () => {
    const payload = { sub: 'user-123', email: 'juan@example.com', name: 'Juan' }
    mockVerify.mockReturnValue(payload)

    const req = makeReq('Bearer valid.token.here') as any

    authenticate(req as Request, res, next)

    expect(req.user).toEqual({
      id: payload.sub,
      email: payload.email,
      name: payload.name,
    })
    expect(next).toHaveBeenCalledWith()
  })
})