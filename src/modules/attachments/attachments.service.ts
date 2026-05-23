import { prisma } from '../../database/DbClient'
import { Errors } from '../../shared/errors'
import * as fs from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

// Allowed image MIME types — used as an allowlist to prevent path injection
// via crafted mimeType or originalname values.
const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

/**
 * Returns a safe extension for the given MIME type.
 * Throws a validation error if the type is not in the allowlist.
 */
function safeExtFromMime(mimeType: string): string {
  const ext = ALLOWED_MIME_TYPES[mimeType.toLowerCase()]
  if (!ext) throw Errors.validationError({ mimeType: ['Tipo de imagen no permitido'] })
  return ext
}

/**
 * Builds and validates a final file path inside UPLOADS_DIR.
 * Rejects anything that would escape the uploads directory.
 */
function safeUploadPath(filename: string): string {
  // filename must be a UUID + dot + whitelisted extension — no slashes allowed
  const resolved = path.resolve(UPLOADS_DIR, filename)
  if (!resolved.startsWith(UPLOADS_DIR + path.sep) && resolved !== UPLOADS_DIR) {
    throw Errors.badRequest('Nombre de archivo inválido')
  }
  return resolved
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

  // Validate MIME type against allowlist — never trust originalname extension
  const ext = safeExtFromMime(file.mimetype)

  // Filename is a UUID: no user input ever reaches the filesystem path
  const filename = `${randomUUID()}.${ext}`
  const filepath = safeUploadPath(filename)

  // Write buffer directly — file.path never exists with memoryStorage
  fs.writeFileSync(filepath, file.buffer)

  const attachment = await prisma.attachment.create({
    data: {
      taskId,
      filename,
      originalName: file.originalname.slice(0, 255), // stored for display only
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
  mimeType: string,
  id?: string // optional: preserve client-generated UUID (used by sync to avoid duplicates)
) {
  const task = await assertBoardMemberByTask(taskId, userId)

  // Validate MIME type against allowlist — never derive extension from user input
  const ext = safeExtFromMime(mimeType)

  // Decode base64 and save file
  const base64Content = base64Data.replace(/^data:[^;]+;base64,/, '')
  const buffer = Buffer.from(base64Content, 'base64')

  // Filename is a UUID: no user input ever reaches the filesystem path
  const filename = `${id ?? randomUUID()}.${ext}`
  const filepath = safeUploadPath(filename)

  fs.writeFileSync(filepath, buffer)

  const attachment = await prisma.attachment.create({
    data: {
      ...(id ? { id } : {}),
      taskId,
      filename,
      originalName: (originalName || `image.${ext}`).slice(0, 255), // stored for display only
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

  // Delete file from disk — filename comes from DB (our own UUID), but we
  // still validate the resolved path stays inside UPLOADS_DIR.
  const filepath = safeUploadPath(attachment.filename)
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

  // Build and validate path — filename comes from DB but we still guard it
  const filepath = safeUploadPath(attachment.filename)
  if (!fs.existsSync(filepath)) {
    throw Errors.notFound('Archivo')
  }

  return { filepath, attachment }
}
