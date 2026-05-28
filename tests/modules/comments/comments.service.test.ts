import { prismaMock, mockFn } from '../../__mocks__/prisma'
import * as commentsService from '../../../src/modules/comments/comments.service'
import { sendPushToUser } from '../../../src/modules/push/push.service'

jest.mock('../../../src/modules/push/push.service', () => ({
  sendPushToUser: jest.fn(),
}))

const task = prismaMock.task as any
const boardMember = prismaMock.boardMember as any
const comment = (prismaMock as any).comment

const mockUserId = 'user-123'
const mockTaskId = 'task-789'
const mockBoardId = 'board-456'
const mockAssigneeId = 'user-assignee'
const mockCreatorId = 'user-creator'

const mockTask = {
  id: mockTaskId,
  boardId: mockBoardId,
  title: 'Mi tarea',
  columnId: 'col-111',
  assigneeId: null,
  createdById: mockCreatorId,
}

const mockMember = {
  boardId: mockBoardId,
  userId: mockUserId,
  role: 'MEMBER',
  joinedAt: new Date(),
}

const mockComment = {
  id: 'comment-001',
  taskId: mockTaskId,
  authorId: mockUserId,
  content: 'Buen trabajo',
  createdAt: new Date(),
  author: { id: mockUserId, name: 'Juan', email: 'juan@example.com', avatarUrl: null },
}

const mockCommentWithRelations = {
  ...mockComment,
  task: {
    title: 'Mi tarea',
    boardId: mockBoardId,
    assigneeId: null,
    createdById: mockCreatorId,
  },
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('commentsService.getComments', () => {
  it('devuelve los comentarios si el usuario es miembro del board', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(mockTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    comment.findMany.mockResolvedValue([mockComment])

    const result = await commentsService.getComments(mockTaskId, mockUserId)

    expect(comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { taskId: mockTaskId } })
    )
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'comment-001' })
  })

  it('lanza NOT_FOUND si la tarea no existe', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(null)

    await expect(commentsService.getComments(mockTaskId, mockUserId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    })
  })
})

describe('commentsService.createComment', () => {
  it('crea un comentario, limpia el objeto task del retorno y notifica al creador de la tarea', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(mockTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    comment.create.mockResolvedValue(mockCommentWithRelations)

    const result = await commentsService.createComment(mockTaskId, mockUserId, 'Buen trabajo')

    expect(comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { taskId: mockTaskId, authorId: mockUserId, content: 'Buen trabajo' },
        include: {
          author: expect.any(Object),
          task: expect.any(Object),
        },
      })
    )

    expect(result.comment).not.toHaveProperty('task')
    expect(result.boardId).toBe(mockBoardId)

    expect(sendPushToUser).toHaveBeenCalledWith(mockCreatorId, expect.objectContaining({
      title: 'Nuevo comentario en "Mi tarea"',
      body: 'Juan: Buen trabajo',
    }))
  })

  it('recorta el preview en el push si el comentario es muy largo', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(mockTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)

    const contenidoLargo = 'A'.repeat(100)
    mockFn(comment, 'create').mockResolvedValue({
      ...mockCommentWithRelations,
      content: contenidoLargo,
    })

    await commentsService.createComment(mockTaskId, mockUserId, contenidoLargo)

    expect(sendPushToUser).toHaveBeenCalledWith(
      mockCreatorId,
      expect.objectContaining({
        body: `Juan: ${'A'.repeat(80)}…`,
      })
    )
  })

  it('notifica tanto al asignado como al creador sin duplicar si son personas distintas', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(mockTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)

    mockFn(comment, 'create').mockResolvedValue({
      ...mockCommentWithRelations,
      task: {
        title: 'Mi tarea',
        boardId: mockBoardId,
        assigneeId: mockAssigneeId,
        createdById: mockCreatorId,
      },
    })

    await commentsService.createComment(mockTaskId, mockUserId, 'Hola a ambos')

    expect(sendPushToUser).toHaveBeenCalledTimes(2)
    expect(sendPushToUser).toHaveBeenCalledWith(mockAssigneeId, expect.any(Object))
    expect(sendPushToUser).toHaveBeenCalledWith(mockCreatorId, expect.any(Object))
  })

  it('no envía notificaciones si el que comenta es el mismo asignado y creador', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(mockTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)

    mockFn(comment, 'create').mockResolvedValue({
      ...mockCommentWithRelations,
      task: {
        title: 'Mi tarea',
        boardId: mockBoardId,
        assigneeId: mockUserId,
        createdById: mockUserId,
      },
    })

    await commentsService.createComment(mockTaskId, mockUserId, 'Anotación para mí mismo')

    expect(sendPushToUser).not.toHaveBeenCalled()
  })

  it('lanza FORBIDDEN si el usuario no es miembro del board', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(mockTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(null)

    await expect(
      commentsService.createComment(mockTaskId, mockUserId, 'Hola')
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 })
  })
})