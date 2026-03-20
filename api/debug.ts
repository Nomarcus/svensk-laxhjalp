export default async function handler(_req: any, res: any) {
  const results: Record<string, string> = {};

  // Test 1: raw require
  try {
    const mod = await import('firebase-admin');
    const keys = Object.keys(mod);
    results['firebase-keys'] = keys.join(', ');
    results['firebase-default'] = typeof mod.default;
    results['firebase-apps'] = String((mod as any).apps || (mod.default as any)?.apps);
  } catch (e: any) {
    results['firebase'] = 'FAIL: ' + e.message + ' | ' + e.stack?.split('\n')[1];
  }

  res.json(results);
}
