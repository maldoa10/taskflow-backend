import { prisma } from '../../database/DbClient'
import { Errors } from '../../shared/errors'
import { Priority } from '@prisma/client'
import type { SyncOperationInput } from './sync.validation'

// Types

interface SyncResult {
  entityId: string
  status: 'applied' | 'conflict' | 'skipped' | 'error'
  serverData?: unknown
  message?: string
}

// Authorization helper

async function assertBoardMember(boardId: string, userId: string) {
  const member = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
  })
  if (!member) throw Errors.forbidden()
  return member
}

// Operation handlers

async function processTaskOp(op: SyncOperationInput, userId: string): Promise<SyncResult> {
  const { entityId, operation, payload, version } = op

  if (operation === 'DELETE') {
    const task = await prisma.task.findUnique({ where: { id: entityId } })
    if (!task) return { entityId, status: 'skipped', message: 'Tarea no encontrada' }
    await assertBoardMember(task.boardId, userId)
    await prisma.task.delete({ where: { id: entityId } })
    return { entityId, status: 'applied' }
  }

  if (operation === 'UPDATE') {
    const task = await prisma.task.findUnique({ where: { id: entityId } })
    if (!task) return { entityId, status: 'skipped', message: 'Tarea no encontrada' }
    await assertBoardMember(task.boardId, userId)

    // Detección de conflicto por versión
    if (task.version !== version) {
      return { entityId, status: 'conflict', serverData: task }
    }

    const updated = await prisma.task.update({
      where: { id: entityId },
      data: {
        ...(payload.title !== undefined && { title: payload.title as string }),
        ...(payload.description !== undefined && {
          description: payload.description as string | null,
        }),
        ...(payload.priority !== undefined && { priority: payload.priority as Priority }),
        ...(payload.dueDate !== undefined && {
          dueDate: payload.dueDate ? new Date(payload.dueDate as string) : null,
        }),
        ...(payload.tags !== undefined && { tags: payload.tags as string[] }),
        ...(payload.assigneeId !== undefined && {
          assigneeId: payload.assigneeId as string | null,
        }),
        version: { increment: 1 },
      },
    })
    return { entityId, status: 'applied', serverData: updated }
  }

  if (operation === 'MOVE') {
    const task = await prisma.task.findUnique({ where: { id: entityId } })
    if (!task) return { entityId, status: 'skipped', message: 'Tarea no encontrada' }
    await assertBoardMember(task.boardId, userId)

    const targetColumnId = payload.columnId as string
    const targetPosition = payload.position as number

    const column = await prisma.column.findFirst({
      where: { id: targetColumnId, boardId: task.boardId },
    })
    if (!column) return { entityId, status: 'error', message: 'Columna destino no encontrada' }

    await prisma.$transaction(async (tx) => {
      if (task.columnId !== targetColumnId) {
        await tx.task.updateMany({
          where: { columnId: task.columnId, position: { gt: task.position } },
          data: { position: { decrement: 1 } },
        })
        await tx.task.updateMany({
          where: { columnId: targetColumnId, position: { gte: targetPosition } },
          data: { position: { increment: 1 } },
        })
      } else {
        if (targetPosition < task.position) {
          await tx.task.updateMany({
            where: {
              columnId: task.columnId,
              position: { gte: targetPosition, lt: task.position },
            },
            data: { position: { increment: 1 } },
          })
        } else if (targetPosition > task.position) {
          await tx.task.updateMany({
            where: {
              columnId: task.columnId,
              position: { gt: task.position, lte: targetPosition },
            },
            data: { position: { decrement: 1 } },
          })
        }
      }
      await tx.task.update({
        where: { id: entityId },
        data: { columnId: targetColumnId, position: targetPosition, version: { increment: 1 } },
      })
    })

    const updated = await prisma.task.findUnique({ where: { id: entityId } })
    return { entityId, status: 'applied', serverData: updated }
  }

  if (operation === 'CREATE') {
    // Idempotent: if already exists (e.g. sync ran twice), skip
    const existing = await prisma.task.findUnique({ where: { id: entityId } })
    if (existing) return { entityId, status: 'skipped', serverData: existing }

    const boardId = payload.boardId as string
    if (!boardId) return { entityId, status: 'error', message: 'boardId requerido' }

    await assertBoardMember(boardId, userId)

    const column = await prisma.column.findFirst({
      where: { id: payload.columnId as string, boardId },
    })
    if (!column) return { entityId, status: 'error', message: 'Columna no encontrada' }

    const task = await prisma.task.create({
      data: {
        id: entityId, // preserve client-generated UUID
        columnId: payload.columnId as string,
        boardId,
        title: payload.title as string,
        description: (payload.description as string) || null,
        priority: (payload.priority as Priority) || 'MEDIUM',
        dueDate: payload.dueDate ? new Date(payload.dueDate as string) : null,
        position: (payload.position as number) ?? 0,
        assigneeId: (payload.assigneeId as string) || null,
        createdById: userId,
        tags: (payload.tags as string[]) || [],
        version: 1,
      },
    })
    return { entityId, status: 'applied', serverData: task }
  }

  return { entityId, status: 'skipped' }
}

async function processBoardOp(op: SyncOperationInput, userId: string): Promise<SyncResult> {
  const { entityId, operation, payload } = op

  if (operation === 'UPDATE') {
    const board = await prisma.board.findUnique({ where: { id: entityId } })
    if (!board) return { entityId, status: 'skipped' }
    await assertBoardMember(entityId, userId)

    const updated = await prisma.board.update({
      where: { id: entityId },
      data: {
        ...(payload.name !== undefined && { name: payload.name as string }),
        ...(payload.description !== undefined && {
          description: payload.description as string | null,
        }),
        ...(payload.color !== undefined && { color: payload.color as string }),
      },
    })
    return { entityId, status: 'applied', serverData: updated }
  }

  return { entityId, status: 'skipped' }
}

async function processCommentOp(op: SyncOperationInput, userId: string): Promise<SyncResult> {
  const { entityId, operation, payload } = op

  if (operation === 'CREATE') {
    // Idempotent: if already exists, skip
    const existing = await prisma.comment.findUnique({ where: { id: entityId } })
    if (existing) return { entityId, status: 'skipped', serverData: existing }

    const taskId = payload.taskId as string
    const content = payload.content as string

    if (!taskId || !content) {
      return { entityId, status: 'error', message: 'taskId y content son requeridos' }
    }

    // Verify the task exists and user is a board member
    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task) return { entityId, status: 'error', message: 'Tarea no encontrada' }

    await assertBoardMember(task.boardId, userId)

    const comment = await prisma.comment.create({
      data: {
        id: entityId, // preserve client-generated UUID
        taskId,
        authorId: userId,
        content,
      },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    })
    return { entityId, status: 'applied', serverData: comment }
  }

  return { entityId, status: 'skipped' }
}

async function processOperation(op: SyncOperationInput, userId: string): Promise<SyncResult> {
  switch (op.entityType) {
    case 'task':
      return processTaskOp(op, userId)
    case 'board':
      return processBoardOp(op, userId)
    case 'comment':
      return processCommentOp(op, userId)
    default:
      return { entityId: op.entityId, status: 'skipped', message: 'Tipo no soportado aún' }
  }
}

// Exports

export async function processSyncBatch(
  operations: SyncOperationInput[],
  userId: string
): Promise<SyncResult[]> {
  // FIFO: ordenar por timestamp
  const sorted = [...operations].sort((a, b) => a.timestamp - b.timestamp)
  const results: SyncResult[] = []

  for (const op of sorted) {
    try {
      results.push(await processOperation(op, userId))
    } catch (err) {
      results.push({
        entityId: op.entityId,
        status: 'error',
        message: err instanceof Error ? err.message : 'Error inesperado',
      })
    }
  }

  return results
}

export async function getChanges(userId: string, since: number) {
  const sinceDate = new Date(since)

  // Obtener boards del usuario
  const memberships = await prisma.boardMember.findMany({
    where: { userId },
    select: { boardId: true },
  })
  const boardIds = memberships.map((m) => m.boardId)

  if (boardIds.length === 0) {
    return { boards: [], columns: [], tasks: [], timestamp: Date.now() }
  }

  const [boards, columns, tasks] = await Promise.all([
    prisma.board.findMany({
      where: { id: { in: boardIds }, updatedAt: { gte: sinceDate } },
    }),
    prisma.column.findMany({
      where: { boardId: { in: boardIds }, createdAt: { gte: sinceDate } },
    }),
    prisma.task.findMany({
      where: { boardId: { in: boardIds }, updatedAt: { gte: sinceDate } },
    }),
  ])

  return { boards, columns, tasks, timestamp: Date.now() }
}
