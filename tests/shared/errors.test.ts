import { Errors } from '../../src/shared/errors'
import { AppError } from '../../src/middleware/errorHandler'

describe('Errors', () => {
  it('unauthorized() devuelve AppError con código UNAUTHORIZED y status 401', () => {
    const err = Errors.unauthorized()
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe('UNAUTHORIZED')
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('No autorizado.')
  })

  it('forbidden() devuelve AppError con código FORBIDDEN y status 403', () => {
    const err = Errors.forbidden()
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe('FORBIDDEN')
    expect(err.statusCode).toBe(403)
    expect(err.message).toBe('Acceso denegado.')
  })

  it('notFound() usa "Recurso" por defecto', () => {
    const err = Errors.notFound()
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.statusCode).toBe(404)
    expect(err.message).toBe('Recurso no encontrado.')
  })

  it('notFound(resource) incluye el nombre del recurso en el mensaje', () => {
    const err = Errors.notFound('Tablero')
    expect(err.message).toBe('Tablero no encontrado.')
  })

  it('conflict(msg) devuelve AppError con código CONFLICT y status 409', () => {
    const err = Errors.conflict('El email ya está en uso.')
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe('CONFLICT')
    expect(err.statusCode).toBe(409)
    expect(err.message).toBe('El email ya está en uso.')
  })

  it('badRequest(msg) devuelve AppError con código BAD_REQUEST y status 400', () => {
    const err = Errors.badRequest('Solicitud incorrecta.')
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe('BAD_REQUEST')
    expect(err.statusCode).toBe(400)
    expect(err.message).toBe('Solicitud incorrecta.')
  })

  it('badRequest(msg, details) incluye los detalles', () => {
    const details = { field: 'name' }
    const err = Errors.badRequest('Error de validación.', details)
    expect(err.details).toEqual(details)
  })

  it('validationError(details) devuelve AppError con código VALIDATION_ERROR y status 422', () => {
    const details = { name: ['requerido'] }
    const err = Errors.validationError(details)
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.statusCode).toBe(422)
    expect(err.message).toBe('Datos invalidos.')
    expect(err.details).toEqual(details)
  })

  it('tooManyRequests(msg) devuelve AppError con código TOO_MANY_REQUESTS y status 429', () => {
    const err = Errors.tooManyRequests('Demasiados intentos.')
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe('TOO_MANY_REQUESTS')
    expect(err.statusCode).toBe(429)
    expect(err.message).toBe('Demasiados intentos.')
  })
})