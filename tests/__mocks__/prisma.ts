import { PrismaClient } from '@prisma/client'

const createModelMock = () => ({
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  createMany: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  count: jest.fn(),
  upsert: jest.fn(),
})

type ModelMock = ReturnType<typeof createModelMock>

export function mockFn(model: ModelMock, method: keyof ModelMock): jest.Mock {
  return model[method] as jest.Mock
}

export const prismaMock = {
  user: createModelMock(),
  board: createModelMock(),
  boardMember: createModelMock(),
  column: createModelMock(),
  task: createModelMock(),
  comment: createModelMock(),
  invitation: createModelMock(),
  pushSubscription: createModelMock(),
  $transaction: jest.fn(),
} as unknown as PrismaClient & {
  user: ModelMock
  board: ModelMock
  boardMember: ModelMock
  column: ModelMock
  task: ModelMock
  comment: ModelMock
  invitation: ModelMock
  pushSubscription: ModelMock
  $transaction: jest.Mock
}

jest.mock('../../src/database/DbClient', () => ({
  prisma: prismaMock,
}))

beforeEach(() => {
  const modelsToReset = ['user', 'board', 'boardMember', 'column', 'task', 'comment', 'invitation', 'pushSubscription'] as const
  modelsToReset.forEach((model) => {
    Object.values(
      prismaMock[model] as unknown as Record<string, jest.Mock>
    ).forEach((fn) => fn.mockReset())
  })
  ;(prismaMock.$transaction as jest.Mock).mockReset()
})