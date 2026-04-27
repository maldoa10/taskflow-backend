import { prisma } from '../../database/DbClient'
import { Errors } from '../../shared/errors'
import { CreateBoardInput, UpdateBoardInput } from './boards.validation'

const DEFAULT_COLUMNS = [
  { name: 'Por Hacer', position: 0 },
  { name: 'En Progreso', position: 1 },
  { name: 'Completado', position: 2 },
]

// Verificar que el usuario es miembro del board
async function assertMember(boardId: string, userId: string) {
  const member = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
  })
  if (!member) throw Errors.forbidden()
  return member
}

async function assertOwner(boardId: string, userId: string) {
  const member = await assertMember(boardId, userId)
  if (member.role !== 'OWNER') throw Errors.forbidden()
}

// Servicios

export async function listBoards(userId: string) {
  const memberships = await prisma.boardMember.findMany({
    where: { userId },
    include: {
      board: {
        include: {
          _count: { select: { tasks: true, members: true } },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  })
  return memberships.map((m) => ({ ...m.board, role: m.role }))
}

export async function createBoard(userId: string, input: CreateBoardInput) {
  const board = await prisma.$transaction(async (tx) => {
    const newBoard = await tx.board.create({
      data: { ...input, ownerId: userId },
    })
    // Agregar al creador como OWNER
    await tx.boardMember.create({
      data: { boardId: newBoard.id, userId, role: 'OWNER' },
    })
    // Crear las 3 columnas por defecto
    await tx.column.createMany({
      data: DEFAULT_COLUMNS.map((col) => ({ ...col, boardId: newBoard.id })),
    })
    return newBoard
  })
  return getBoard(board.id, userId)
}

export async function getBoard(boardId: string, userId: string) {
  await assertMember(boardId, userId)
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      columns: {
        orderBy: { position: 'asc' },
        include: {
          tasks: { orderBy: { position: 'asc' } },
        },
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      },
    },
  })
  if (!board) throw Errors.notFound('Tablero')
  return board
}

export async function updateBoard(boardId: string, userId: string, input: UpdateBoardInput) {
  await assertMember(boardId, userId)
  return prisma.board.update({
    where: { id: boardId },
    data: input,
  })
}

export async function deleteBoard(boardId: string, userId: string) {
  await assertOwner(boardId, userId)
  await prisma.board.delete({ where: { id: boardId } })
}
