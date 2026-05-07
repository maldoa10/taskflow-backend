import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import type { Server } from 'http'
import { verifyAccessToken } from '../modules/auth/auth.service'
import { joinRoom, leaveAllRooms } from './rooms'
import { logger } from '../utils/logger'

export interface AuthenticatedSocket extends WebSocket {
  userId?: string
}

export function initWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (ws: AuthenticatedSocket, req: IncomingMessage) => {
    // Extract token from query string (e.g. /ws?token=...)
    const rawUrl = req.url ?? ''
    const qs = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?') + 1) : ''
    const params = new URLSearchParams(qs)
    const token = params.get('token')

    if (!token) {
      ws.close(4001, 'No token provided')
      return
    }

    try {
      const payload = verifyAccessToken(token)
      ws.userId = payload.sub
    } catch {
      ws.close(4001, 'Invalid token')
      return
    }

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>
        if (msg.type === 'JOIN_BOARD' && typeof msg.boardId === 'string') {
          joinRoom(msg.boardId, ws)
        }
      } catch {
        // ignore malformed messages
      }
    })

    ws.on('close', () => {
      leaveAllRooms(ws)
    })

    ws.on('error', (err) => {
      logger.error({ err }, '[WS] Socket error')
    })
  })

  logger.info('[WS] WebSocket server initialized on /ws')
}
