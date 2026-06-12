// Audit form definitions — mirror the Connecteam "(Small) Site Audit" and
// "Large Site Audit" forms. Sliders are 0-10. The Large audit is conditional:
// the category set (and therefore the max score) changes for Porsche showroom
// vs Crave. Scores are normalised to 0-100 so the 80/70 health bands hold.

export type AuditCategoryDef = {
  key: string;
  label: string;
  description?: string;
};

export type FormType = 'small' | 'large';
export type SiteVariant = 'porsche_showroom' | 'crave';

// (Small) Site Audit — quarterly, smaller sites. 4 categories → /40.
export const SMALL_CATEGORIES: AuditCategoryDef[] = [
  { key: 'overall_cleanliness', label: 'Overall Cleanliness' },
  { key: 'floors', label: 'Floors', description: 'Vacuumed/mopped, no debris' },
  { key: 'surfaces', label: 'Surfaces', description: 'Desks, counters, windowsills dusted and wiped' },
  { key: 'toilets_kitchens', label: 'Toilets/Kitchens', description: 'If applicable — clean, stocked, no odours' },
];

// Large Site Audit — Porsche showroom. 8 categories → /80.
export const LARGE_PORSCHE_CATEGORIES: AuditCategoryDef[] = [
  { key: 'showroom_floor', label: 'Showroom Floor Areas' },
  { key: 'reception', label: 'Reception/Waiting area', description: 'Desks, counters, windowsills dusted and wiped, vacuumed/mopped' },
  { key: 'toilets', label: 'Toilets', description: 'Clean, stocked, no odours, streak free' },
  { key: 'glass_mirrors', label: 'Glass/Mirrors', description: 'Clear of streaks' },
  { key: 'staff_areas', label: 'Staff areas', description: 'Desks, counters, windowsills dusted and wiped, vacuumed/mopped' },
  { key: 'kitchen', label: 'Kitchen areas' },
  { key: 'workshop_floor', label: 'Workshop floor', description: 'Centre lane clean and clear of dirt and tyre marks' },
  { key: 'cleaning_cupboard', label: 'Cleaning cupboard', description: 'Organisation and cleanliness of the cleaning cupboard' },
];

// Large Site Audit — Crave. 5 categories → /50.
export const LARGE_CRAVE_CATEGORIES: AuditCategoryDef[] = [
  { key: 'restaurant_floors', label: 'Restaurant Floors', description: 'Vacuumed/mopped, no debris' },
  { key: 'toilets', label: 'Toilets', description: 'Clean, stocked, no odours, streak free' },
  { key: 'glass_mirrors', label: 'Glass/Mirrors', description: 'Clear of streaks' },
  { key: 'kitchen', label: 'Kitchen areas' },
  { key: 'cleaning_cupboard', label: 'Cleaning cupboard', description: 'Organisation and cleanliness of the cleaning cupboard' },
];

export function getCategoryDefs(formType: FormType, variant?: SiteVariant | null): AuditCategoryDef[] {
  if (formType === 'small') return SMALL_CATEGORIES;
  if (variant === 'crave') return LARGE_CRAVE_CATEGORIES;
  return LARGE_PORSCHE_CATEGORIES; // default large = Porsche
}

export type ScoredCategory = { key: string; label: string; score: number; note?: string };

// Normalise raw category total to a 0-100 score (preserves 80/70 bands).
export function computeAuditScore(categories: ScoredCategory[]): {
  rawScore: number;
  maxScore: number;
  overallScore: number;
} {
  const rawScore = categories.reduce((s, c) => s + (Number(c.score) || 0), 0);
  const maxScore = categories.length * 10;
  const overallScore = maxScore > 0 ? Math.round((rawScore / maxScore) * 100) : 0;
  return { rawScore, maxScore, overallScore };
}

export function isValidFormType(v: unknown): v is FormType {
  return v === 'small' || v === 'large';
}

export function isValidVariant(v: unknown): v is SiteVariant {
  return v === 'porsche_showroom' || v === 'crave';
}
