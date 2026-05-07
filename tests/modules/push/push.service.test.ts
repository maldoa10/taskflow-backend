import { prismaMock } from '../../__mocks__/prisma'

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}))
jest.mock('../../../src/utils/logger', () => ({ logger: { warn: jest.fn() } }))
jest.mock('../../../src/config/env', () => ({
  env: {
    VAPID_PUBLIC_KEY: 'mock-public-key',
    VAPID_PRIVATE_KEY: 'mock-private-key',
    VAPID_EMAIL: 'mailto:test@test.com',
  },
}))

import webPush from 'web-push'
import * as pushService from '../../../src/modules/push/push.service'

const pushSubscription = (prismaMock as any).pushSubscription
const mockWebPush = webPush as jest.Mocked<typeof webPush>

const mockUserId = 'user-123'
const mockEndpoint = 'https://push.example.com/sub/abc123'

const mockSub = {
  id: 'sub-001',
  userId: mockUserId,
  endpoint: mockEndpoint,
  p256dh: 'p256dh-key',
  auth: 'auth-key',
  createdAt: new Date(),
}

beforeEach(() => {
  jest.clearAllMocks()
})

// saveSubscription

describe('pushService.saveSubscription', () => {
  it('elimina la suscripción previa y crea una nueva', async () => {
    pushSubscription.deleteMany.mockResolvedValue({ count: 0 })
    pushSubscription.create.mockResolvedValue(mockSub)

    const result = await pushService.saveSubscription(
      mockUserId, mockEndpoint, 'p256dh-key', 'auth-key'
    )

    expect(pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { endpoint: mockEndpoint } })
    expect(pushSubscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: mockUserId, endpoint: mockEndpoint }),
      })
    )
    expect(result).toMatchObject({ id: 'sub-001' })
  })
})

// removeSubscription

describe('pushService.removeSubscription', () => {
  it('elimina la suscripción del usuario por endpoint', async () => {
    pushSubscription.deleteMany.mockResolvedValue({ count: 1 })

    await pushService.removeSubscription(mockUserId, mockEndpoint)

    expect(pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { userId: mockUserId, endpoint: mockEndpoint },
    })
  })
})

// sendPushToUser

describe('pushService.sendPushToUser', () => {
  const payload = { title: 'Nuevo comentario', body: 'Alguien comentó tu tarea' }

  it('envía notificación a todas las suscripciones del usuario', async () => {
    pushSubscription.findMany.mockResolvedValue([mockSub])
    mockWebPush.sendNotification.mockResolvedValue({} as any)

    await pushService.sendPushToUser(mockUserId, payload)

    expect(pushSubscription.findMany).toHaveBeenCalledWith({ where: { userId: mockUserId } })
    expect(mockWebPush.sendNotification).toHaveBeenCalledWith(
      { endpoint: mockEndpoint, keys: { p256dh: 'p256dh-key', auth: 'auth-key' } },
      JSON.stringify(payload)
    )
  })

  it('no hace nada si el usuario no tiene suscripciones', async () => {
    pushSubscription.findMany.mockResolvedValue([])

    await pushService.sendPushToUser(mockUserId, payload)

    expect(mockWebPush.sendNotification).not.toHaveBeenCalled()
  })

  it('elimina la suscripción si web-push devuelve 410 Gone', async () => {
    pushSubscription.findMany.mockResolvedValue([mockSub])
    pushSubscription.delete = jest.fn().mockResolvedValue({})
    const goneError = { statusCode: 410 }
    mockWebPush.sendNotification.mockRejectedValue(goneError)

    await pushService.sendPushToUser(mockUserId, payload)

    expect(pushSubscription.delete).toHaveBeenCalledWith({ where: { id: 'sub-001' } })
  })

  it('registra warning si web-push falla con error distinto a 410', async () => {
    const { logger } = require('../../../src/utils/logger')
    pushSubscription.findMany.mockResolvedValue([mockSub])
    mockWebPush.sendNotification.mockRejectedValue(new Error('Network error'))

    await pushService.sendPushToUser(mockUserId, payload)

    expect(logger.warn).toHaveBeenCalled()
    expect(pushSubscription.delete).not.toHaveBeenCalled()
  })

  it('no envía notificaciones si VAPID keys no están configuradas', async () => {
    jest.resetModules()
    jest.doMock('../../../src/config/env', () => ({
      env: { VAPID_PUBLIC_KEY: undefined, VAPID_PRIVATE_KEY: undefined },
    }))
    // Re-importar para que tome el nuevo mock
    const { sendPushToUser } = require('../../../src/modules/push/push.service')
    pushSubscription.findMany.mockResolvedValue([mockSub])

    await sendPushToUser(mockUserId, payload)

    expect(mockWebPush.sendNotification).not.toHaveBeenCalled()
  })
})