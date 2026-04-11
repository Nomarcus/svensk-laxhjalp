import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccount)),
    });
  } else {
    // Falls back to Application Default Credentials (works on Cloud Run)
    admin.initializeApp();
  }
}

export interface AuthenticatedRequest extends Request {
  /** Endast denna uid får användas för Firestore-sökvägar som users/{uid}/… — aldrig userId från klient-body. */
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

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Ingen autentisering. Logga in först.' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    if (req.path.startsWith('/admin') && decoded.email_verified !== true) {
      res.status(403).json({ error: 'Verifierad e-post krävs för admin.' });
      return;
    }
    req.uid = decoded.uid;
    req.email = decoded.email;
    next();
  } catch {
    res.status(401).json({ error: 'Ogiltig token. Logga in igen.' });
  }
}
