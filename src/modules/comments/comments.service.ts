import { prisma } from '../../database/DbClient'
import { Errors } from '../../shared/errors'

async function assertBoardMemberByTask(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) throw Errors.notFound('Tarea')
  const member = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId: task.boardId, userId } },
  })
  if (!member) throw Errors.forbidden()
  return task
}

export async function getComments(taskId: string, userId: string) {
  await assertBoardMemberByTask(taskId, userId)
  return prisma.comment.findMany({
    where: { taskId },
    include: {
      author: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
}

export async function createComment(taskId: string, userId: string, content: string) {
  const task = await assertBoardMemberByTask(taskId, userId)
  const comment = await prisma.comment.create({
    data: { taskId, authorId: userId, content },
    include: {
      author: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  })
  return { comment, boardId: task.boardId }
}
