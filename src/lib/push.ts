import webpush from 'web-push';
import { prisma } from './db';

// Lazy init: previously this ran at module load and crashed the whole server
// cold-start if any VAPID env var was missing. Now we init on first send and
// the call becomes a no-op (with a warning) if env is misconfigured.
let vapidReady: boolean | null = null;

function ensureVapid(): boolean {
  if (vapidReady !== null) return vapidReady;
  const subject = process.env.VAPID_SUBJECT;
  const pubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !pubKey || !privKey) {
    console.warn('[push] VAPID env missing — push notifications disabled');
    vapidReady = false;
    return false;
  }
  try {
    webpush.setVapidDetails(subject, pubKey, privKey);
    vapidReady = true;
    return true;
  } catch (err) {
    console.error('[push] VAPID setup failed:', err);
    vapidReady = false;
    return false;
  }
}

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
  if (!ensureVapid()) return;

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
