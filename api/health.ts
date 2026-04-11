

import { applyApiSecurity } from './_lib/httpSecurity';

export default function handler(_req: any, res: any) {
  if (!applyApiSecurity(_req, res)) return;
  res.json({ status: 'ok' });
}
