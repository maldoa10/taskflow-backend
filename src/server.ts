import 'dotenv/config'
import { createServer } from 'http'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { errorHandler } from './middleware/errorHandler'
import { logger } from './utils/logger'
import { env } from './config/env'
import authRoutes from './modules/auth/auth.routes'
import boardsRoutes from './modules/boards/boards.routes'
import boardTasksRoutes from './modules/tasks/tasks.routes'
import tasksRoutes from './modules/tasks/tasks.direct.routes'
import syncRoutes from './modules/sync/sync.routes'
import commentsRoutes from './modules/comments/comments.routes'
import invitationsRoutes from './modules/invitations/invitations.routes'
import pushRoutes from './modules/push/push.routes'
import { initWebSocket } from './websocket/wsServer'

const app = express()
const PORT = env.PORT

// Seguridad y utilidades
app.use(helmet())
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
)
app.use(compression())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  })
})

// Rutas
app.use('/api/auth', authRoutes)
app.use('/api/boards', boardsRoutes)
app.use('/api/boards/:boardId/tasks', boardTasksRoutes)
app.use('/api/tasks', tasksRoutes)
app.use('/api/sync', syncRoutes)
app.use('/api/tasks/:taskId/comments', commentsRoutes)
app.use('/api/invitations', invitationsRoutes)
app.use('/api/push', pushRoutes)

// Manejo de errores
app.use(errorHandler)

// Crear servidor HTTP y adjuntar WebSocket
const server = createServer(app)
initWebSocket(server)

server.listen(PORT, () => {
  logger.info(`[TaskFlow API] Servidor corriendo en http://localhost:${PORT}`)
  logger.info(`[TaskFlow API] Health check: http://localhost:${PORT}/api/health`)
  logger.info(`[TaskFlow API] WebSocket: ws://localhost:${PORT}/ws`)
})

export default app
