import { PrismaClient } from '@prisma/client'

const createModelMock = () => ({
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  upsert: jest.fn(),
})

type ModelMock = ReturnType<typeof createModelMock>

export function mockFn(model: ModelMock, method: keyof ModelMock): jest.Mock {
  return model[method] as jest.Mock
}

export const prismaMock = {
  user: createModelMock(),
} as unknown as PrismaClient & { user: ModelMock }

jest.mock('../../src/database/DbClient', () => ({
  prisma: prismaMock,
}))

beforeEach(() => {
  Object.values(prismaMock.user as unknown as Record<string, jest.Mock>).forEach((fn) => fn.mockReset())
})