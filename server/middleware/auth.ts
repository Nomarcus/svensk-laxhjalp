import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../../src/lib/supabase-server';

export interface AuthenticatedRequest extends Request {
  uid?: string;
  email?: string;
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip auth for health check
  if (req.path === '/health') {
    next();
    return;
  }

  try {
    const { uid, email } = await verifyToken(req.headers.authorization);
    req.uid = uid;
    req.email = email;
    next();
  } catch {
    res.status(401).json({ error: 'Ogiltig token. Logga in igen.' });
  }
}
