import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { buildAdminOverviewPayload, isSoleAdminFromEnv } from '../lib/adminOverviewPayload';
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

export { router as adminRouter };
