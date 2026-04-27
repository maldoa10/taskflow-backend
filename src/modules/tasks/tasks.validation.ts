import { z } from 'zod'

const Priority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])

export const createTaskSchema = z.object({
  columnId: z.string().uuid('columnId inválido'),
  title: z.string().min(1, 'El título es requerido').max(200),
  description: z.string().max(5000).optional(),
  priority: Priority.default('MEDIUM'),
  dueDate: z.coerce.date().optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
  tags: z.array(z.string().max(30)).max(10).default([]),
})

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  priority: Priority.optional(),
  dueDate: z.coerce.date().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  columnId: z.string().uuid().optional(),
})

export const moveTaskSchema = z.object({
  columnId: z.string().uuid('columnId inválido'),
  position: z.number().int().min(0),
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
export type MoveTaskInput = z.infer<typeof moveTaskSchema>
