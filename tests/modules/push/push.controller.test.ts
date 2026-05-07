import { Request, Response, NextFunction } from 'express'
import { getVapidPublicKey, subscribe, unsubscribe } from '../../../src/modules/push/push.controller'
import { AppError } from '../../../src/middleware/errorHandler'

jest.mock('../../../src/modules/push/push.service', () => ({
  saveSubscription: jest.fn(),
  removeSubscription: jest.fn(),
}))
jest.mock('../../../src/config/env', () => ({
  env: { VAPID_PUBLIC_KEY: 'mock-public-key' },
}))

import { saveSubscription, removeSubscription } from '../../../src/modules/push/push.service'

const mockSaveSubscription = saveSubscription as jest.Mock
const mockRemoveSubscription = removeSubscription as jest.Mock

function makeRes(): Partial<Response> {
  const res: Partial<Response> = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  res.send = jest.fn().mockReturnValue(res)
  return res
}

function makeReq(body = {}, extra = {}): Partial<Request> {
  return { body, user: { id: 'user-123', name: 'Juan' }, ...extra } as any
}

const next = jest.fn() as jest.MockedFunction<NextFunction>

beforeEach(() => {
  jest.clearAllMocks()
})

// getVapidPublicKey

describe('getVapidPublicKey controller', () => {
  it('devuelve la clave pública VAPID', async () => {
    const req = makeReq()
    const res = makeRes()

    await getVapidPublicKey(req as Request, res as Response)

    expect(res.json).toHaveBeenCalledWith({ publicKey: 'mock-public-key' })
  })
})

// subscribe

describe('subscribe controller', () => {
  const validBody = {
    endpoint: 'https://push.example.com/sub/abc',
    keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
  }

  it('responde 201 al guardar la suscripción correctamente', async () => {
    mockSaveSubscription.mockResolvedValue(undefined)
    const req = makeReq(validBody)
    const res = makeRes()

    await subscribe(req as Request, res as Response, next)

    expect(mockSaveSubscription).toHaveBeenCalledWith(
      'user-123', validBody.endpoint, validBody.keys.p256dh, validBody.keys.auth
    )
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ ok: true })
    expect(next).not.toHaveBeenCalled()
  })

  it('llama next con VALIDATION_ERROR si endpoint no es URL', async () => {
    const req = makeReq({ endpoint: 'no-es-url', keys: { p256dh: 'k', auth: 'a' } })
    const res = makeRes()

    await subscribe(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }))
    expect(mockSaveSubscription).not.toHaveBeenCalled()
  })

  it('llama next con VALIDATION_ERROR si faltan las keys', async () => {
    const req = makeReq({ endpoint: 'https://push.example.com/sub/abc' })
    const res = makeRes()

    await subscribe(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }))
  })

  it('llama next si el servicio falla', async () => {
    mockSaveSubscription.mockRejectedValue(new AppError('INTERNAL', 'Error', 500))
    const req = makeReq(validBody)
    const res = makeRes()

    await subscribe(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'INTERNAL' }))
  })
})

// unsubscribe

describe('unsubscribe controller', () => {
  it('responde 204 al eliminar la suscripción', async () => {
    mockRemoveSubscription.mockResolvedValue(undefined)
    const req = makeReq({ endpoint: 'https://push.example.com/sub/abc' })
    const res = makeRes()

    await unsubscribe(req as Request, res as Response, next)

    expect(mockRemoveSubscription).toHaveBeenCalledWith(
      'user-123', 'https://push.example.com/sub/abc'
    )
    expect(res.status).toHaveBeenCalledWith(204)
    expect(res.send).toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  it('llama next con VALIDATION_ERROR si no se envía endpoint', async () => {
    const req = makeReq({})
    const res = makeRes()

    await unsubscribe(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }))
    expect(mockRemoveSubscription).not.toHaveBeenCalled()
  })

  it('llama next si el servicio falla', async () => {
    mockRemoveSubscription.mockRejectedValue(new AppError('INTERNAL', 'Error', 500))
    const req = makeReq({ endpoint: 'https://push.example.com/sub/abc' })
    const res = makeRes()

    await unsubscribe(req as Request, res as Response, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'INTERNAL' }))
  })
})