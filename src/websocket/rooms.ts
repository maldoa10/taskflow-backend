import type { WebSocket } from 'ws'

// boardId → Set of connected sockets
const rooms = new Map<string, Set<WebSocket>>()

export function joinRoom(boardId: string, ws: WebSocket): void {
  if (!rooms.has(boardId)) rooms.set(boardId, new Set())
  rooms.get(boardId)!.add(ws)
}

export function leaveAllRooms(ws: WebSocket): void {
  for (const [boardId, members] of rooms.entries()) {
    members.delete(ws)
    if (members.size === 0) rooms.delete(boardId)
  }
}

/**
 * Broadcast a message to all sockets in a board room, optionally excluding one.
 */
export function broadcast(boardId: string, message: unknown, exclude?: WebSocket): void {
  const members = rooms.get(boardId)
  if (!members) return
  const data = JSON.stringify(message)
  for (const ws of members) {
    if (ws !== exclude && ws.readyState === 1 /* OPEN */) {
      ws.send(data)
    }
  }
}
