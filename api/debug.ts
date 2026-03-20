export default async function handler(_req: any, res: any) {
  const results: Record<string, string> = {};

  try {
    const mod = await import('firebase-admin');
    const admin = mod.default;
    const adminKeys = Object.keys(admin).slice(0, 15);
    results['admin-keys'] = adminKeys.join(', ');
    results['admin-apps-type'] = typeof admin.apps;
    results['admin-apps-isArray'] = String(Array.isArray(admin.apps));
    results['admin-apps-length'] = String(admin.apps?.length);
    results['admin-credential'] = typeof admin.credential;
    results['admin-initializeApp'] = typeof admin.initializeApp;

    // Try to init
    if (admin.apps?.length === 0 || !admin.apps?.length) {
      const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (sa) {
        const parsed = JSON.parse(sa);
        results['sa-project'] = parsed.project_id;
        admin.initializeApp({
          credential: admin.credential.cert(parsed),
        });
        results['init'] = 'OK - apps: ' + admin.apps.length;

        const auth = admin.auth();
        results['auth'] = typeof auth.verifyIdToken === 'function' ? 'OK' : 'FAIL';

        const db = admin.firestore();
        results['db'] = typeof db.doc === 'function' ? 'OK' : 'FAIL';
      } else {
        results['sa'] = 'NOT SET';
      }
    }
  } catch (e: any) {
    results['error'] = e.message;
    results['stack'] = e.stack?.split('\n').slice(0, 3).join(' | ');
  }

  res.json(results);
}
