import { z } from 'zod'

const SyncEntityType = z.enum(['task', 'column', 'board', 'comment'])
const SyncOperationType = z.enum(['CREATE', 'UPDATE', 'DELETE', 'MOVE'])

export const syncOperationSchema = z.object({
  entityType: SyncEntityType,
  entityId: z.string().uuid(),
  operation: SyncOperationType,
  payload: z.record(z.string(), z.unknown()),
  timestamp: z.number(),
  version: z.number().int().min(1).default(1),
})

export const syncBatchSchema = z.object({
  operations: z.array(syncOperationSchema).min(1).max(100),
})

export type SyncOperationInput = z.infer<typeof syncOperationSchema>
export type SyncBatchInput = z.infer<typeof syncBatchSchema>
