import webPush from 'web-push'
import { prisma } from '../../database/DbClient'
import { env } from '../../config/env'
import { logger } from '../../utils/logger'

// Configure VAPID once on module load
if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    env.VAPID_EMAIL ?? 'mailto:admin@taskflow.app',
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  )
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  icon?: string
}

/** Save or update a push subscription for a user.
 *
 * A push endpoint uniquely identifies a single browser install — it is NOT
 * per-user. If the same endpoint already exists under ANY user (e.g. the
 * previous person logged in on this browser), remove it first so we never
 * send notifications to the wrong account.
 */
export async function saveSubscription(
  userId: string,
  endpoint: string,
  p256dh: string,
  auth: string
) {
  // Delete any existing record for this endpoint (regardless of which user
  // it belonged to) before creating the new one.
  await prisma.pushSubscription.deleteMany({ where: { endpoint } })
  return prisma.pushSubscription.create({
    data: { userId, endpoint, p256dh, auth },
  })
}

/** Remove a subscription by endpoint */
export async function removeSubscription(userId: string, endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } })
}

/** Send a push notification to all subscriptions of a user */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return

  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  if (subs.length === 0) return

  const data = JSON.stringify(payload)

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          data
        )
      } catch (err: unknown) {
        // 410 Gone = subscription expired, remove it
        if (
          typeof err === 'object' &&
          err !== null &&
          'statusCode' in err &&
          (err as { statusCode: number }).statusCode === 410
        ) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        } else {
          logger.warn({ err, userId, endpoint: sub.endpoint }, '[Push] Failed to send notification')
        }
      }
    })
  )
}
