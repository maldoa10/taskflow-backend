import { errorHandler, AppError } from '../../src/middleware/errorHandler'
import { logger } from '../../src/utils/logger'

jest.mock('../../src/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

describe('errorHandler', () => {
  const mockReq = {
    url: '/test',
    method: 'GET',
  } as any

  const mockRes = () => {
    const res: any = {}
    res.status = jest.fn().mockReturnValue(res)
    res.json = jest.fn().mockReturnValue(res)
    return res
  }

  const mockNext = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('debería manejar AppError 4xx con warn y sin loguear error', () => {
    const err = new AppError('TEST_ERROR', 'Error controlado', 400)
    const res = mockRes()

    errorHandler(err, mockReq, res, mockNext)

    expect(logger.warn).toHaveBeenCalledWith(
      { code: 'TEST_ERROR', status: 400, method: 'GET', path: '/test' },
      'Error controlado'
    )
    expect(logger.error).not.toHaveBeenCalled()

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'TEST_ERROR',
        message: 'Error controlado',
      },
    })
  })

  it('debería manejar AppError 5xx con error log', () => {
    const err = new AppError('SERVER_ERROR', 'Error de servidor', 500)
    const res = mockRes()

    errorHandler(err, mockReq, res, mockNext)

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'SERVER_ERROR',
        status: 500,
        method: 'GET',
        path: '/test',
        err,
      }),
      'Error de servidor'
    )
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('debería incluir details en la respuesta si están presentes', () => {
    const details = { field: 'email', issue: 'inválido' }
    const err = new AppError('VALIDATION_ERROR', 'Datos inválidos', 422, details)
    const res = mockRes()

    errorHandler(err, mockReq, res, mockNext)

    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos inválidos',
        details,
      },
    })
  })

  it('debería loguear error inesperado y retornar 500', () => {
    const err = new Error('Fallo inesperado')
    const res = mockRes()

    errorHandler(err, mockReq, res, mockNext)

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err, path: '/test', method: 'GET' }),
      'Error inesperado en el servidor'
    )
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Ocurrió un error interno del servidor.',
      },
    })
  })
})