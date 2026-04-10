import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined && { details: err.details }),
      },
    })
    return
  }

  // Error inesperado
  logger.error({
    err,
    path: req.url,
    method: req.method,
  },
    'Error inesperado en el servidor')

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Ocurrió un error interno del servidor.',
    },
  })
}
