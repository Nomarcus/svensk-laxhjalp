import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { buildAdminOverviewPayload, isSoleAdminFromEnv } from '../lib/adminOverviewPayload';
import { buildAdminAnalyticsPayload } from '../lib/adminAnalyticsPayload';
import { getServerFirestore } from '../lib/serverFirestore';

const router = Router();

function isSoleAdmin(req: AuthenticatedRequest): boolean {
  return isSoleAdminFromEnv(req.uid, req.email);
}

// GET /api/admin/overview
router.get('/admin/overview', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isSoleAdmin(req)) {
      res.status(403).json({ error: 'Forbidden', code: 'admin_forbidden' });
      return;
    }

    const db = getServerFirestore();
    const payload = await buildAdminOverviewPayload(db);
    res.json(payload);
  } catch (err: unknown) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'Admin overview failed.' });
  }
});

// GET /api/admin/analytics?range=day|week|month|year|all
router.get('/admin/analytics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isSoleAdmin(req)) {
      res.status(403).json({ error: 'Forbidden', code: 'admin_forbidden' });
      return;
    }

    const range = typeof req.query.range === 'string' ? req.query.range : 'month';
    const db = getServerFirestore();
    const payload = await buildAdminAnalyticsPayload(db, range);
    res.json(payload);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Admin analytics error:', err);
    res.status(500).json({ error: 'Admin analytics failed.', detail: msg.slice(0, 500) });
  }
});

export { router as adminRouter };
