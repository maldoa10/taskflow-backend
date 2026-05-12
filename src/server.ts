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
import attachmentsRoutes from './modules/attachments/attachments.routes'
import invitationsRoutes from './modules/invitations/invitations.routes'
import pushRoutes from './modules/push/push.routes'
import { initWebSocket } from './websocket/wsServer'

const app = express()
const PORT = env.PORT

// Seguridad y utilidades
app.use(helmet())

const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim())
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
      callback(new Error(`CORS: origin ${origin} not allowed`))
    },
    credentials: true,
  })
)
app.use(compression())
app.use(express.json({ limit: '15mb' })) // base64 images add ~33% overhead over the 10MB file cap
app.use(express.urlencoded({ extended: true, limit: '15mb' }))

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
app.use('/api/tasks/:taskId/attachments', attachmentsRoutes)
app.use('/api/invitations', invitationsRoutes)
app.use('/api/push', pushRoutes)

// Manejo de errores
app.use(errorHandler)

// Crear servidor HTTP y adjuntar WebSocket
const server = createServer(app)
initWebSocket(server)

server.listen(PORT, () => {
  logger.warn(`[TaskFlow API] Servidor corriendo en http://localhost:${PORT}`)
  logger.warn(`[TaskFlow API] Health check: http://localhost:${PORT}/api/health`)
  logger.warn(`[TaskFlow API] WebSocket: ws://localhost:${PORT}/ws`)
})

export default app
