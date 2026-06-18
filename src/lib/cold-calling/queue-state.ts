/**
 * Cold-calling queue classification — pure.
 *
 * A lead's queue is derived ONLY from (callStatus, nextCallAt, now). Because a
 * lead has exactly one callStatus, it maps to at most one queue bucket — so the
 * "lead in two queues" and "badge disagrees with list" bug classes are
 * impossible by construction. Counts and lists both go through `classify`, so
 * they can never diverge.
 */

import type { LeadCallStatus } from './state';
import { isCallableStatus, isTerminalStatus } from './state';
import { isDue } from './time';

/** The buckets the VA sees. Same set as the callable statuses. */
export type QueueBucket = 'callback' | 'renewal' | 'retry' | 'nurturing' | 'new' | 'dormant';

export interface QueueRow {
  id: string;
  callStatus: LeadCallStatus;
  nextCallAt: Date | null;
}

/** Priority order for "who do I call next". Lower index = higher priority. */
export const BUCKET_PRIORITY: QueueBucket[] = [
  'callback', // promised, time-sensitive
  'renewal', // dated opportunity
  'retry', // already in motion
  'nurturing', // warm, awaiting follow-up
  'new', // fresh
  'dormant', // revival
];

/**
 * The single bucket a lead belongs to right now, or null if it is terminal or
 * not yet due. The bucket name equals the callStatus (the callable statuses are
 * exactly the buckets).
 */
export function classify(row: QueueRow, now: Date): QueueBucket | null {
  if (isTerminalStatus(row.callStatus)) return null;
  if (!isCallableStatus(row.callStatus)) return null;
  if (!isDue(row.nextCallAt, now)) return null;
  return row.callStatus as QueueBucket;
}

function priorityIndex(bucket: QueueBucket): number {
  const i = BUCKET_PRIORITY.indexOf(bucket);
  return i === -1 ? BUCKET_PRIORITY.length : i;
}

/** Effective due time for ordering; null (a brand-new lead) sorts as most-due. */
function dueTime(row: QueueRow): number {
  return row.nextCallAt?.getTime() ?? Number.NEGATIVE_INFINITY;
}

/**
 * Sort comparator for the VA's queue: by bucket priority, then soonest due.
 * Rows that are not currently due/terminal sort to the end (they shouldn't be
 * passed in, but we guard anyway).
 */
export function compareForQueue(a: QueueRow, b: QueueRow, now: Date): number {
  const ba = classify(a, now);
  const bb = classify(b, now);
  if (ba && bb) {
    const pd = priorityIndex(ba) - priorityIndex(bb);
    if (pd !== 0) return pd;
    return dueTime(a) - dueTime(b);
  }
  if (ba && !bb) return -1;
  if (!ba && bb) return 1;
  return 0;
}

/** Count rows per bucket using the SAME predicate as the list. */
export function bucketCounts(rows: QueueRow[], now: Date): Record<QueueBucket, number> {
  const counts: Record<QueueBucket, number> = {
    callback: 0,
    renewal: 0,
    retry: 0,
    nurturing: 0,
    new: 0,
    dormant: 0,
  };
  for (const row of rows) {
    const bucket = classify(row, now);
    if (bucket) counts[bucket] += 1;
  }
  return counts;
}

/** The next lead to call from an in-memory set (used in tests; prod uses a locked SQL query). */
export function nextInQueue(rows: QueueRow[], now: Date): QueueRow | null {
  const due = rows.filter((r) => classify(r, now) !== null);
  if (due.length === 0) return null;
  return due.sort((a, b) => compareForQueue(a, b, now))[0];
}
