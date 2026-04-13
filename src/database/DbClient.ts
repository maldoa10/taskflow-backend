import { PrismaClient } from '@prisma/client'
import { logger } from '../utils/logger'
import { env } from '../config/env'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient() {
  const prisma = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
      { emit: 'event', level: 'info' },
    ],
  })

  const prismaLogger = logger.child({ module: 'prisma' })

  if (env.NODE_ENV === 'development') {
    prisma.$on('query', (e) => {
      prismaLogger.debug({ query: e.query, params: e.params, duration: e.duration }, 'Query')
    })
  }

  prisma.$on('warn', (e) => prismaLogger.warn(e.message))
  prisma.$on('info', (e) => prismaLogger.info(e.message))
  prisma.$on('error', (e) => prismaLogger.error(e.message))

  return prisma
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
