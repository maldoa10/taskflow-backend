import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { errorHandler } from './middleware/errorHandler'
import authRoutes from './modules/auth/auth.routes'

const app = express()
const PORT = process.env.PORT ?? 4000

// ─── Seguridad y utilidades ────────────────────────────────────────────────────
app.use(helmet())
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  })
)
app.use(compression())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'development',
  })
})

// ─── Rutas ─────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)

// ─── Manejo de errores ────────────────────────────────────────────────────────
app.use(errorHandler)

// ─── Iniciar servidor ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[TaskFlow API] Servidor corriendo en http://localhost:${PORT}`)
  console.log(`[TaskFlow API] Health check: http://localhost:${PORT}/api/health`)
})

export default app
