import { errorHandler, AppError } from '../../src/middleware/errorHandler'
import { logger } from '../../src/utils/logger'

jest.mock('../../src/utils/logger', () => ({
  logger: {
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

  it('debería manejar AppError correctamente sin loguear error', () => {
    const err = new AppError('TEST_ERROR', 'Error controlado', 400)
    const res = mockRes()

    errorHandler(err, mockReq, res, mockNext)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'TEST_ERROR',
        message: 'Error controlado',
      },
    })

    expect(logger.error).not.toHaveBeenCalled()
  })

  it('debería loguear error inesperado y retornar 500', () => {
    const err = new Error('Fallo inesperado')
    const res = mockRes()

    errorHandler(err, mockReq, res, mockNext)

    expect(logger.error).toHaveBeenCalledTimes(1)

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err,
        path: '/test',
        method: 'GET',
      }),
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