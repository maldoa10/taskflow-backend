import { prisma } from '../../database/DbClient'
import { Errors } from '../../shared/errors'
import { sendPushToUser } from '../push/push.service'

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
      task: { select: { title: true, boardId: true, assigneeId: true, createdById: true } },
    },
  })

  const { title, boardId, assigneeId, createdById } = comment.task
  const authorName = comment.author.name
  const preview = content.length > 80 ? content.slice(0, 80) + '…' : content
  const payload = {
    title: `Nuevo comentario en "${title}"`,
    body: `${authorName}: ${preview}`,
    url: `/board/${boardId}`,
  }

  const notified = new Set<string>()

  if (assigneeId && assigneeId !== userId) {
    await sendPushToUser(assigneeId, payload)
    notified.add(assigneeId)
  }

  if (createdById !== userId && !notified.has(createdById)) {
    await sendPushToUser(createdById, payload)
  }

  const { task: _task, ...commentWithoutTask } = comment
  return { comment: commentWithoutTask, boardId: task.boardId }
}
