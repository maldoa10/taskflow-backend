import { AppError } from '../middleware/errorHandler'

export const Errors = {
  unauthorized: () => new AppError('UNAUTHORIZED', 'No autorizado.', 401),
  forbidden: () => new AppError('FORBIDDEN', 'Acceso denegado.', 403),
  notFound: (resource = 'Recurso') =>
    new AppError('NOT_FOUND', `${resource} no encontrado.`, 404),
  conflict: (msg: string) => new AppError('CONFLICT', msg, 409),
  badRequest: (msg: string, details?: unknown) =>
    new AppError('BAD_REQUEST', msg, 400, details),
  validationError: (details: unknown) =>
    new AppError('VALIDATION_ERROR', 'Datos inválidos.', 422, details),
}
