import { prismaMock, mockFn } from '../../__mocks__/prisma'
import * as commentsService from '../../../src/modules/comments/comments.service'

const task = prismaMock.task as any
const boardMember = prismaMock.boardMember as any
const comment = (prismaMock as any).comment

const mockUserId = 'user-123'
const mockTaskId = 'task-789'
const mockBoardId = 'board-456'

const mockTask = {
  id: mockTaskId,
  boardId: mockBoardId,
  title: 'Mi tarea',
  columnId: 'col-111',
  assigneeId: null,
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

beforeEach(() => {
  jest.clearAllMocks()
})

// getComments

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

  it('lanza FORBIDDEN si el usuario no es miembro del board', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(mockTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(null)

    await expect(commentsService.getComments(mockTaskId, mockUserId)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    })
  })
})

// createComment

describe('commentsService.createComment', () => {
  it('crea un comentario y devuelve el comentario con el boardId', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(mockTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(mockMember)
    comment.create.mockResolvedValue(mockComment)

    const result = await commentsService.createComment(mockTaskId, mockUserId, 'Buen trabajo')

    expect(comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taskId: mockTaskId,
          authorId: mockUserId,
          content: 'Buen trabajo',
        }),
      })
    )
    expect(result.comment).toMatchObject({ id: 'comment-001' })
    expect(result.boardId).toBe(mockBoardId)
  })

  it('lanza NOT_FOUND si la tarea no existe', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(null)

    await expect(
      commentsService.createComment(mockTaskId, mockUserId, 'Hola')
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 })
  })

  it('lanza FORBIDDEN si el usuario no es miembro del board', async () => {
    mockFn(task, 'findUnique').mockResolvedValue(mockTask)
    mockFn(boardMember, 'findUnique').mockResolvedValue(null)

    await expect(
      commentsService.createComment(mockTaskId, mockUserId, 'Hola')
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 })
  })
})