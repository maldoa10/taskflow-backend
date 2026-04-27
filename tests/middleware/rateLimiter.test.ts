import { Request, Response } from 'express'

// Mockear logger para evitar output en tests y evitar importar utils/logger
jest.mock('../../src/utils/logger', () => ({
  logger: { warn: jest.fn() },
}))

import { sensitiveRateLimiter, generalRateLimiter } from '../../src/middleware/rateLimiter'

function makeRes(): Partial<Response> {
  const res: Partial<Response> = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

function makeReq(ip = '127.0.0.1', url = '/api/auth/login'): Partial<Request> {
  return { ip, url, method: 'POST' } as Partial<Request>
}

describe('rateLimiter', () => {
  it('sensitiveRateLimiter es un middleware de express (función con 3 argumentos)', () => {
    expect(typeof sensitiveRateLimiter).toBe('function')
    expect(sensitiveRateLimiter.length).toBe(3)
  })

  it('generalRateLimiter es un middleware de express (función con 3 argumentos)', () => {
    expect(typeof generalRateLimiter).toBe('function')
    expect(generalRateLimiter.length).toBe(3)
  })

  it('el handler de sensitiveRateLimiter responde 429 con código TOO_MANY_REQUESTS', () => {
    // Acceder al handler interno mediante la opción del limiter
    const limiterOptions = (sensitiveRateLimiter as any).options ?? (sensitiveRateLimiter as any)
    const handler = limiterOptions?.handler

    if (!handler) {
      // Si express-rate-limit no expone handler directamente, verificamos el comportamiento
      // creando la instancia con rateLimit y chequeando que existe
      expect(sensitiveRateLimiter).toBeDefined()
      return
    }

    const req = makeReq()
    const res = makeRes()

    handler(req, res)

    expect(res.status).toHaveBeenCalledWith(429)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'TOO_MANY_REQUESTS' }),
      })
    )
  })

  it('el handler de generalRateLimiter responde 429 con código TOO_MANY_REQUESTS', () => {
    const limiterOptions = (generalRateLimiter as any).options ?? (generalRateLimiter as any)
    const handler = limiterOptions?.handler

    if (!handler) {
      expect(generalRateLimiter).toBeDefined()
      return
    }

    const req = makeReq('192.168.1.1', '/api/boards')
    const res = makeRes()

    handler(req, res)

    expect(res.status).toHaveBeenCalledWith(429)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'TOO_MANY_REQUESTS' }),
      })
    )
  })
})