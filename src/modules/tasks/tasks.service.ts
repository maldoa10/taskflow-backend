import { prisma } from '../../database/DbClient'
import { Errors } from '../../shared/errors'
import { CreateTaskInput, UpdateTaskInput, MoveTaskInput } from './tasks.validation'
import { sendPushToUser } from '../push/push.service'

async function assertBoardMember(boardId: string, userId: string) {
  const member = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
  })
  if (!member) throw Errors.forbidden()
  return member
}

export async function getBoardTasks(boardId: string, userId: string) {
  await assertBoardMember(boardId, userId)
  return prisma.task.findMany({
    where: { boardId },
    orderBy: [{ columnId: 'asc' }, { position: 'asc' }],
  })
}

export async function createTask(boardId: string, userId: string, input: CreateTaskInput) {
  await assertBoardMember(boardId, userId)

  const column = await prisma.column.findFirst({ where: { id: input.columnId, boardId } })
  if (!column) throw Errors.notFound('Columna')

  const lastTask = await prisma.task.findFirst({
    where: { columnId: input.columnId },
    orderBy: { position: 'desc' },
  })
  const position = lastTask ? lastTask.position + 1 : 0

  const task = await prisma.task.create({
    data: {
      ...input,
      boardId,
      createdById: userId,
      position,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
    },
    include: { board: { select: { name: true } } },
  })

  if (task.assigneeId && task.assigneeId !== userId) {
    await sendPushToUser(task.assigneeId, {
      title: 'Te asignaron una tarea',
      body: `"${task.title}" en el tablero "${task.board.name}"`,
      url: `/board/${boardId}`,
    })
  }

  const { board: _board, ...taskWithoutBoard } = task
  return taskWithoutBoard
}

export async function updateTask(taskId: string, userId: string, input: UpdateTaskInput) {
  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) throw Errors.notFound('Tarea')
  await assertBoardMember(task.boardId, userId)

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...input,
      dueDate:
        input.dueDate !== undefined ? (input.dueDate ? new Date(input.dueDate) : null) : undefined,
      version: { increment: 1 },
    },
    include: { board: { select: { name: true } } },
  })

  const assigneeChanged = input.assigneeId !== undefined && input.assigneeId !== task.assigneeId
  if (assigneeChanged && updated.assigneeId && updated.assigneeId !== userId) {
    await sendPushToUser(updated.assigneeId, {
      title: 'Te asignaron una tarea',
      body: `"${updated.title}" en el tablero "${updated.board.name}"`,
      url: `/board/${updated.boardId}`,
    })
  }

  const { board: _board, ...taskWithoutBoard } = updated
  return taskWithoutBoard
}

export async function deleteTask(taskId: string, userId: string): Promise<string> {
  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) throw Errors.notFound('Tarea')
  await assertBoardMember(task.boardId, userId)
  await prisma.task.delete({ where: { id: taskId } })
  return task.boardId
}

export async function moveTask(taskId: string, userId: string, input: MoveTaskInput) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { board: { select: { name: true } }, column: { select: { name: true } } },
  })
  if (!task) throw Errors.notFound('Tarea')
  await assertBoardMember(task.boardId, userId)

  const { columnId, position } = input

  const column = await prisma.column.findFirst({ where: { id: columnId, boardId: task.boardId } })
  if (!column) throw Errors.notFound('Columna destino')

  const columnChanged = task.columnId !== columnId

  await prisma.$transaction(async (tx) => {
    if (columnChanged) {
      await tx.task.updateMany({
        where: { columnId: task.columnId, position: { gt: task.position } },
        data: { position: { decrement: 1 } },
      })
      await tx.task.updateMany({
        where: { columnId, position: { gte: position } },
        data: { position: { increment: 1 } },
      })
    } else {
      if (position < task.position) {
        await tx.task.updateMany({
          where: { columnId, position: { gte: position, lt: task.position } },
          data: { position: { increment: 1 } },
        })
      } else if (position > task.position) {
        await tx.task.updateMany({
          where: { columnId, position: { gt: task.position, lte: position } },
          data: { position: { decrement: 1 } },
        })
      }
    }
    await tx.task.update({
      where: { id: taskId },
      data: { columnId, position, version: { increment: 1 } },
    })
  })

  if (columnChanged && task.assigneeId && task.assigneeId !== userId) {
    await sendPushToUser(task.assigneeId, {
      title: 'Tarea movida',
      body: `"${task.title}" fue movida a "${column.name}" en "${task.board.name}"`,
      url: `/board/${task.boardId}`,
    })
  }

  return prisma.task.findUnique({ where: { id: taskId } })
}
