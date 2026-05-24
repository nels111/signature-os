// Org-wide settings singleton.
// One row in `org_settings` keyed `singleton`. If absent, sane defaults apply.
//
// Why: the £17/hr labour rate used to be hardcoded in 6+ places. Now it's
// editable in one place (Settings UI), and any caller that needs the default
// (new sites, quote builder, fallback in margin/health) reads from here.
//
// Per-site Site.labourRatePerHour still overrides this default when set.

import { prisma } from '@/lib/db'

const DEFAULT_LABOUR_RATE = 17

export interface OrgSettings {
  defaultLabourRatePerHour: number
  updatedAt: string | null
  updatedBy: string | null
}

let cache: { value: OrgSettings; expires: number } | null = null
const CACHE_TTL_MS = 60 * 1000 // 60s — cheap read, edits feel instant

export async function getOrgSettings(): Promise<OrgSettings> {
  if (cache && Date.now() < cache.expires) return cache.value

  try {
    const row = await prisma.orgSettings.findUnique({ where: { id: 'singleton' } })
    const value: OrgSettings = {
      defaultLabourRatePerHour: row ? Number(row.defaultLabourRatePerHour) : DEFAULT_LABOUR_RATE,
      updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
      updatedBy: row?.updatedBy ?? null,
    }
    cache = { value, expires: Date.now() + CACHE_TTL_MS }
    return value
  } catch {
    // DB unreachable — return defaults so the app stays up
    return {
      defaultLabourRatePerHour: DEFAULT_LABOUR_RATE,
      updatedAt: null,
      updatedBy: null,
    }
  }
}

export async function getDefaultLabourRate(): Promise<number> {
  const settings = await getOrgSettings()
  return settings.defaultLabourRatePerHour
}

export function invalidateOrgSettingsCache() {
  cache = null
}
