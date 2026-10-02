import type { TFunction } from 'i18next';

/**
 * Årskurs sparas som en siffra i en sträng. Servern (parseGradeLevel i
 * server/routes/ai.ts) läser första siffran 0–12 och väljer språknivå och
 * tillåtna räknemetoder efter den. Utan siffra förstår servern ingen årskurs
 * alls, och svaren blir inte åldersanpassade. "Förskoleklass" sparas därför
 * som 0 och gymnasiets år 1–3 som 10–12.
 */
export const GRADE_VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'] as const;

export function isKnownGrade(value: string | undefined | null): boolean {
  return Boolean(value && (GRADE_VALUES as readonly string[]).includes(value.trim()));
}

/**
 * Läsbart namn för en sparad årskurs. Äldre barnprofiler kan ha fritext
 * ("4B", "fyran"); den visas då som den står.
 */
export function gradeLabel(value: string | undefined | null, t: TFunction): string {
  const v = value?.trim() ?? '';
  if (!v) return '';
  if (!isKnownGrade(v)) return v;
  const n = Number(v);
  if (n === 0) return t('grade.preschool');
  if (n >= 10) return t('grade.upperSecondary', { year: n - 9 });
  return t('grade.year', { n });
}
