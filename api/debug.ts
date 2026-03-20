export default function handler(_req: any, res: any) {
  res.json({
    ok: true,
    node: process.version,
    env_keys: Object.keys(process.env).filter(k => k.startsWith('GEMINI') || k.startsWith('FIREBASE') || k.startsWith('STRIPE')),
  });
}
