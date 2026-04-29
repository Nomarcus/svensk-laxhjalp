/**
 * Detects if a text looks like a requirements/criteria list from a teacher.
 * Returns true if it has characteristics of a requirements list.
 */
export function isRequirementsList(text: string): boolean {
  if (!text || text.length < 200) return false;

  // Check for "Du skall" pattern (most reliable indicator of Swedish requirements)
  const duSkallCount = (text.match(/Du sk[aä]ll?/gi) || []).length;
  if (duSkallCount >= 3) return true;

  // Check for bullet points
  const bulletCount = (text.match(/[•·●]/g) || []).length;
  if (bulletCount >= 5) return true;

  // Check for "Krav för" pattern
  const kravCount = (text.match(/Krav för/gi) || []).length;
  if (kravCount >= 2) return true;

  // Check for "betyget" pattern (grade requirements)
  const betygCount = (text.match(/betyget?\s+[A-E]/gi) || []).length;
  if (betygCount >= 2) return true;

  return false;
}
