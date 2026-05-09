import { prisma } from '../../database/DbClient'
import { Errors } from '../../shared/errors'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuid } from 'crypto'

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

async function assertBoardMemberByTask(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) throw Errors.notFound('Tarea')
  const member = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId: task.boardId, userId } },
  })
  if (!member) throw Errors.forbidden()
  return task
}

export async function getAttachments(taskId: string, userId: string) {
  await assertBoardMemberByTask(taskId, userId)
  return prisma.attachment.findMany({
    where: { taskId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createAttachment(taskId: string, userId: string, file: Express.Multer.File) {
  const task = await assertBoardMemberByTask(taskId, userId)

  // Generate unique filename
  const ext = path.extname(file.originalname)
  const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`
  const filepath = path.join(UPLOADS_DIR, filename)

  // Move file from temp to uploads
  fs.renameSync(file.path, filepath)

  const attachment = await prisma.attachment.create({
    data: {
      taskId,
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadedById: userId,
    },
  })

  return { attachment, boardId: task.boardId }
}

export async function createAttachmentFromBase64(
  taskId: string,
  userId: string,
  base64Data: string,
  originalName: string,
  mimeType: string
) {
  const task = await assertBoardMemberByTask(taskId, userId)

  // Decode base64 and save file
  const base64Content = base64Data.replace(/^data:[^;]+;base64,/, '')
  const buffer = Buffer.from(base64Content, 'base64')

  const ext = mimeType.split('/')[1] || 'jpg'
  const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
  const filepath = path.join(UPLOADS_DIR, filename)

  fs.writeFileSync(filepath, buffer)

  const attachment = await prisma.attachment.create({
    data: {
      taskId,
      filename,
      originalName: originalName || `image.${ext}`,
      mimeType,
      size: buffer.length,
      uploadedById: userId,
    },
  })

  return { attachment, boardId: task.boardId }
}

export async function deleteAttachment(attachmentId: string, userId: string) {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { task: true },
  })

  if (!attachment) throw Errors.notFound('Archivo adjunto')

  // Check if user is board member
  const member = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId: attachment.task.boardId, userId } },
  })
  if (!member) throw Errors.forbidden()

  // Delete file from disk
  const filepath = path.join(UPLOADS_DIR, attachment.filename)
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath)
  }

  await prisma.attachment.delete({ where: { id: attachmentId } })

  return { boardId: attachment.task.boardId }
}

export async function getAttachmentFile(attachmentId: string, userId: string) {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { task: true },
  })

  if (!attachment) throw Errors.notFound('Archivo adjunto')

  // Check if user is board member
  const member = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId: attachment.task.boardId, userId } },
  })
  if (!member) throw Errors.forbidden()

  const filepath = path.join(UPLOADS_DIR, attachment.filename)
  if (!fs.existsSync(filepath)) {
    throw Errors.notFound('Archivo')
  }

  return { filepath, attachment }
}
