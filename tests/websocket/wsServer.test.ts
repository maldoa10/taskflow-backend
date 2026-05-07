import { EventEmitter } from 'events'

// Capturamos la instancia del WSS en el momento que se crea, para poder
// extraer el handler de 'connection' sin depender de mock.instances.
// El constructor del mock llama a __setWssInstance() exportado desde este módulo.
let wssInstance: EventEmitter

jest.mock('ws', () => {
  const { EventEmitter } = require('events')
  class MockWebSocketServer extends EventEmitter {
    constructor(_opts: unknown) {
      super()
      // Registrar esta instancia en el test para poder acceder a sus listeners
      const testModule = require('./wsServer.test')
      testModule.__setWssInstance(this)
    }
  }
  return { WebSocketServer: MockWebSocketServer, WebSocket: EventEmitter }
})

jest.mock('../../src/modules/auth/auth.service', () => ({
  verifyAccessToken: jest.fn(),
}))
jest.mock('../../src/websocket/rooms', () => ({
  joinRoom: jest.fn(),
  leaveAllRooms: jest.fn(),
}))

const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
jest.mock('../../src/utils/logger', () => ({ logger: mockLogger }))

import { verifyAccessToken } from '../../src/modules/auth/auth.service'
import { joinRoom, leaveAllRooms } from '../../src/websocket/rooms'
import { initWebSocket } from '../../src/websocket/wsServer'

// Función exportada para que el constructor del mock pueda registrar la instancia
export function __setWssInstance(instance: EventEmitter) {
  wssInstance = instance
}

const mockVerifyAccessToken = verifyAccessToken as jest.Mock
const mockJoinRoom = joinRoom as jest.Mock
const mockLeaveAllRooms = leaveAllRooms as jest.Mock

function makeSocket(url = '/ws?token=valid-token') {
  const ws = new EventEmitter() as any
  ws.send = jest.fn()
  ws.close = jest.fn()
  ws.readyState = 1
  ws.userId = undefined
  return { ws, req: { url } }
}

function getConnectionHandler() {
  const listeners = wssInstance.listeners('connection')
  if (listeners.length === 0) throw new Error('No connection handler registered on wss')
  return listeners[0] as (ws: any, req: any) => void
}

beforeEach(() => {
  jest.clearAllMocks()
  initWebSocket({} as any)
})

// Autenticación en el handshake

describe('wsServer — autenticación en conexión', () => {
  it('cierra la conexión con 4001 si no hay token', () => {
    const { ws, req } = makeSocket('/ws')

    getConnectionHandler()(ws, req)

    expect(ws.close).toHaveBeenCalledWith(4001, 'No token provided')
    expect(mockVerifyAccessToken).not.toHaveBeenCalled()
  })

  it('cierra la conexión con 4001 si el token es inválido', () => {
    mockVerifyAccessToken.mockImplementation(() => { throw new Error('Token inválido') })
    const { ws, req } = makeSocket('/ws?token=bad-token')

    getConnectionHandler()(ws, req)

    expect(ws.close).toHaveBeenCalledWith(4001, 'Invalid token')
  })

  it('asigna userId al socket si el token es válido', () => {
    mockVerifyAccessToken.mockReturnValue({ sub: 'user-123', email: 'juan@example.com' })
    const { ws, req } = makeSocket('/ws?token=valid-token')

    getConnectionHandler()(ws, req)

    expect(ws.userId).toBe('user-123')
    expect(ws.close).not.toHaveBeenCalled()
  })

  it('maneja req.url undefined cerrando con 4001', () => {
    const { ws } = makeSocket()
    const req = { url: undefined }

    getConnectionHandler()(ws, req)

    expect(ws.close).toHaveBeenCalledWith(4001, 'No token provided')
  })
})

// Handler de mensajes

describe('wsServer — handler de mensajes', () => {
  beforeEach(() => {
    mockVerifyAccessToken.mockReturnValue({ sub: 'user-123', email: 'juan@example.com' })
  })

  it('llama joinRoom al recibir JOIN_BOARD con boardId válido', () => {
    const { ws, req } = makeSocket()
    getConnectionHandler()(ws, req)

    ws.emit('message', Buffer.from(JSON.stringify({ type: 'JOIN_BOARD', boardId: 'board-456' })))

    expect(mockJoinRoom).toHaveBeenCalledWith('board-456', ws)
  })

  it('no llama joinRoom si boardId no es string', () => {
    const { ws, req } = makeSocket()
    getConnectionHandler()(ws, req)

    ws.emit('message', Buffer.from(JSON.stringify({ type: 'JOIN_BOARD', boardId: 123 })))

    expect(mockJoinRoom).not.toHaveBeenCalled()
  })

  it('no llama joinRoom si type no es JOIN_BOARD', () => {
    const { ws, req } = makeSocket()
    getConnectionHandler()(ws, req)

    ws.emit('message', Buffer.from(JSON.stringify({ type: 'PING' })))

    expect(mockJoinRoom).not.toHaveBeenCalled()
  })

  it('ignora mensajes con JSON malformado sin lanzar error', () => {
    const { ws, req } = makeSocket()
    getConnectionHandler()(ws, req)

    expect(() => ws.emit('message', Buffer.from('{ invalid json }'))).not.toThrow()
    expect(mockJoinRoom).not.toHaveBeenCalled()
  })
})

// Handler de cierre

describe('wsServer — handler de cierre', () => {
  it('llama leaveAllRooms cuando el socket se cierra', () => {
    mockVerifyAccessToken.mockReturnValue({ sub: 'user-123', email: 'juan@example.com' })
    const { ws, req } = makeSocket()
    getConnectionHandler()(ws, req)

    ws.emit('close')

    expect(mockLeaveAllRooms).toHaveBeenCalledWith(ws)
  })
})

// Handler de error

describe('wsServer — handler de error', () => {
  it('loguea el error cuando ocurre un error en el socket', () => {
    mockVerifyAccessToken.mockReturnValue({ sub: 'user-123', email: 'juan@example.com' })
    const { ws, req } = makeSocket()
    getConnectionHandler()(ws, req)

    const err = new Error('Socket failure')
    ws.emit('error', err)

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err }),
      '[WS] Socket error'
    )
  })
})