import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { errorHandler } from './middleware/errorHandler'
import { logger } from './utils/logger'
import { env } from './config/env'
import authRoutes from './modules/auth/auth.routes'

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

// ─── Rutas ─────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)

// Manejo de errores
app.use(errorHandler)

// Iniciar servidor
app.listen(PORT, () => {
  logger.info(`[TaskFlow API] Servidor corriendo en http://localhost:${PORT}`)
  logger.info(`[TaskFlow API] Health check: http://localhost:${PORT}/api/health`)
})

export default app
