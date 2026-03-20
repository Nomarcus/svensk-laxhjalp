import { getAuthAdmin } from './firebase';

export interface AuthUser {
  uid: string;
  email?: string;
}

export async function verifyAuth(req: any, res: any): Promise<AuthUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Ingen autentisering. Logga in först.' });
    return null;
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const authAdmin = await getAuthAdmin();
    const decoded = await authAdmin.verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    res.status(401).json({ error: 'Ogiltig token. Logga in igen.' });
    return null;
  }
}
