import { joinRoom, leaveAllRooms, broadcast } from '../../src/websocket/rooms'
import type { WebSocket } from 'ws'

// Helper: crea un WebSocket mock con readyState configurable
function makeSocket(readyState: number = 1): jest.Mocked<WebSocket> {
  return {
    readyState,
    send: jest.fn(),
  } as unknown as jest.Mocked<WebSocket>
}

// Limpiar el estado interno del módulo entre tests reutilizando leaveAllRooms
afterEach(() => {
  // Limpiar todos los sockets conocidos del módulo
  // Como rooms es un Map privado, la forma más limpia es hacer leaveAllRooms
  // de todos los sockets que hayamos creado en cada test
})

describe('joinRoom', () => {
  it('crea la room y agrega el socket', () => {
    const ws = makeSocket()
    joinRoom('board-1', ws)

    // Verificar indirectamente: broadcast debe llegar al socket
    broadcast('board-1', { type: 'TEST' })
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'TEST' }))

    leaveAllRooms(ws)
  })

  it('agrega múltiples sockets a la misma room', () => {
    const ws1 = makeSocket()
    const ws2 = makeSocket()
    joinRoom('board-2', ws1)
    joinRoom('board-2', ws2)

    broadcast('board-2', { type: 'PING' })

    expect(ws1.send).toHaveBeenCalledTimes(1)
    expect(ws2.send).toHaveBeenCalledTimes(1)

    leaveAllRooms(ws1)
    leaveAllRooms(ws2)
  })

  it('no duplica el socket si se une dos veces a la misma room', () => {
    const ws = makeSocket()
    joinRoom('board-3', ws)
    joinRoom('board-3', ws) // segunda vez

    broadcast('board-3', { type: 'PING' })

    expect(ws.send).toHaveBeenCalledTimes(1)
    leaveAllRooms(ws)
  })
})

describe('leaveAllRooms', () => {
  it('elimina el socket de todas las rooms en las que está', () => {
    const ws = makeSocket()
    joinRoom('board-a', ws)
    joinRoom('board-b', ws)

    leaveAllRooms(ws)

    // Después de salir, broadcast no debe llegar al socket
    broadcast('board-a', { type: 'X' })
    broadcast('board-b', { type: 'X' })

    expect(ws.send).not.toHaveBeenCalled()
  })

  it('elimina la room del mapa cuando queda vacía', () => {
    const ws = makeSocket()
    joinRoom('board-empty', ws)
    leaveAllRooms(ws)

    // Si la room fue eliminada, broadcast no hace nada (no lanza error)
    expect(() => broadcast('board-empty', { type: 'X' })).not.toThrow()
  })

  it('no lanza error si el socket no está en ninguna room', () => {
    const ws = makeSocket()
    expect(() => leaveAllRooms(ws)).not.toThrow()
  })

  it('no elimina la room si aún quedan otros sockets', () => {
    const ws1 = makeSocket()
    const ws2 = makeSocket()
    joinRoom('board-persist', ws1)
    joinRoom('board-persist', ws2)

    leaveAllRooms(ws1) // solo ws1 sale

    broadcast('board-persist', { type: 'STILL_ALIVE' })
    expect(ws2.send).toHaveBeenCalledTimes(1)
    expect(ws1.send).not.toHaveBeenCalled()

    leaveAllRooms(ws2)
  })
})

describe('broadcast', () => {
  it('serializa el mensaje a JSON antes de enviarlo', () => {
    const ws = makeSocket()
    joinRoom('board-json', ws)

    const msg = { type: 'UPDATE', payload: { id: '123' } }
    broadcast('board-json', msg)

    expect(ws.send).toHaveBeenCalledWith(JSON.stringify(msg))
    leaveAllRooms(ws)
  })

  it('no envía al socket excluido', () => {
    const ws1 = makeSocket()
    const ws2 = makeSocket()
    joinRoom('board-exclude', ws1)
    joinRoom('board-exclude', ws2)

    broadcast('board-exclude', { type: 'MSG' }, ws1) // excluir ws1

    expect(ws1.send).not.toHaveBeenCalled()
    expect(ws2.send).toHaveBeenCalledTimes(1)

    leaveAllRooms(ws1)
    leaveAllRooms(ws2)
  })

  it('no envía a sockets con readyState distinto de OPEN (1)', () => {
    const wsOpen = makeSocket(1)   // OPEN
    const wsClose = makeSocket(3)  // CLOSED
    const wsConnect = makeSocket(0) // CONNECTING

    joinRoom('board-state', wsOpen)
    joinRoom('board-state', wsClose)
    joinRoom('board-state', wsConnect)

    broadcast('board-state', { type: 'TEST' })

    expect(wsOpen.send).toHaveBeenCalledTimes(1)
    expect(wsClose.send).not.toHaveBeenCalled()
    expect(wsConnect.send).not.toHaveBeenCalled()

    leaveAllRooms(wsOpen)
    leaveAllRooms(wsClose)
    leaveAllRooms(wsConnect)
  })

  it('no hace nada si la room no existe', () => {
    expect(() => broadcast('room-inexistente', { type: 'X' })).not.toThrow()
  })

  it('no envía a ningún socket si todos están excluidos', () => {
    const ws = makeSocket()
    joinRoom('board-all-excluded', ws)

    broadcast('board-all-excluded', { type: 'MSG' }, ws)

    expect(ws.send).not.toHaveBeenCalled()
    leaveAllRooms(ws)
  })
})