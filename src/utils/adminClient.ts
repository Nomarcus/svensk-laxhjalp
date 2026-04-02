/**
 * Show Admin nav only for the sole admin (mirror server: VITE_ADMIN_UID and/or VITE_ADMIN_EMAIL).
 * If both are set, both must match. Real auth is on /api/admin.
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
  return false;
}
