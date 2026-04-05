/** Same e-post som ska sättas som ADMIN_EMAIL på Cloud Run (utan VITE_* i bygget). */
export const OPERATOR_ADMIN_EMAIL = 'nomarcus@hotmail.com';

/**
 * Visa Admin i menyn: VITE_ADMIN_UID / VITE_ADMIN_EMAIL om satta, annars inloggad operatör (OPERATOR_ADMIN_EMAIL).
 * Verifiering sker på servern (/api/admin).
 */
export function shouldShowAdminNav(
  uid: string | null | undefined,
  email: string | null | undefined,
): boolean {
  const viteUid = (import.meta.env.VITE_ADMIN_UID as string | undefined)?.trim();
  const viteEmail = (import.meta.env.VITE_ADMIN_EMAIL as string | undefined)?.trim().toLowerCase();

  if (viteUid && viteEmail) {
    return Boolean(
      uid && email && uid === viteUid && email.toLowerCase() === viteEmail,
    );
  }
  if (viteUid) return Boolean(uid && uid === viteUid);
  if (viteEmail) return Boolean(email && email.toLowerCase() === viteEmail);
  return Boolean(email && email.toLowerCase() === OPERATOR_ADMIN_EMAIL.toLowerCase());
}
