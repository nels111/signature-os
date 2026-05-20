import webpush from 'web-push';
import { prisma } from './db';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  tag?: string;
}

/**
 * Send a push notification to all subscribed devices for a given user.
 * Invalid subscriptions (410 Gone) are automatically cleaned up.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const subs = await prisma.$queryRaw<Array<{
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }>>`SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${userId}`;

  const sends = subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 410 || status === 404) {
        // Subscription expired — clean up
        await prisma.$executeRaw`DELETE FROM push_subscriptions WHERE id = ${sub.id}`;
      }
    }
  });

  await Promise.allSettled(sends);
}

/**
 * Send a push notification to all subscribed devices for a list of users.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  await Promise.allSettled(userIds.map((id) => sendPushToUser(id, payload)));
}

/**
 * Send a push notification to all users with admin or sales roles.
 * Used for site visit notifications (Nelson + Nick).
 */
export async function sendPushToAdminAndSales(payload: PushPayload): Promise<void> {
  const users = await prisma.user.findMany({
    where: { role: { in: ['admin', 'sales'] } },
    select: { id: true },
  });
  await sendPushToUsers(users.map((u) => u.id), payload);
}
