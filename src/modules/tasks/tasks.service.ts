import { prisma } from '../../database/DbClient'
import { Errors } from '../../shared/errors'
import { CreateTaskInput, UpdateTaskInput, MoveTaskInput } from './tasks.validation'

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

  // Verificar que la columna pertenece al board
  const column = await prisma.column.findFirst({
    where: { id: input.columnId, boardId },
  })
  if (!column) throw Errors.notFound('Columna')

  // Calcular posición (al final de la columna)
  const lastTask = await prisma.task.findFirst({
    where: { columnId: input.columnId },
    orderBy: { position: 'desc' },
  })
  const position = lastTask ? lastTask.position + 1 : 0

  return prisma.task.create({
    data: {
      ...input,
      boardId,
      createdById: userId,
      position,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
    },
  })
}

export async function updateTask(taskId: string, userId: string, input: UpdateTaskInput) {
  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) throw Errors.notFound('Tarea')
  await assertBoardMember(task.boardId, userId)

  return prisma.task.update({
    where: { id: taskId },
    data: {
      ...input,
      dueDate: input.dueDate !== undefined
        ? input.dueDate ? new Date(input.dueDate) : null
        : undefined,
      version: { increment: 1 },
    },
  })
}

export async function deleteTask(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) throw Errors.notFound('Tarea')
  await assertBoardMember(task.boardId, userId)
  await prisma.task.delete({ where: { id: taskId } })
}

export async function moveTask(taskId: string, userId: string, input: MoveTaskInput) {
  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) throw Errors.notFound('Tarea')
  await assertBoardMember(task.boardId, userId)

  const { columnId, position } = input

  // Verificar que la columna destino existe en el mismo board
  const column = await prisma.column.findFirst({
    where: { id: columnId, boardId: task.boardId },
  })
  if (!column) throw Errors.notFound('Columna destino')

  await prisma.$transaction(async (tx) => {
    // Sacar la tarea de su posición actual en la columna origen
    if (task.columnId !== columnId) {
      await tx.task.updateMany({
        where: { columnId: task.columnId, position: { gt: task.position } },
        data: { position: { decrement: 1 } },
      })
      // Hacer hueco en la columna destino
      await tx.task.updateMany({
        where: { columnId, position: { gte: position } },
        data: { position: { increment: 1 } },
      })
    } else {
      // Misma columna — reordenar
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
    // Mover la tarea
    await tx.task.update({
      where: { id: taskId },
      data: { columnId, position, version: { increment: 1 } },
    })
  })

  return prisma.task.findUnique({ where: { id: taskId } })
}
