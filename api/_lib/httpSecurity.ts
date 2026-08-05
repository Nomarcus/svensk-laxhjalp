const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://lead-agent-489101.web.app',
  'https://foraldrahjalpen.se',
  'https://www.foraldrahjalpen.se',
];

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const RATE_STORE_KEY = '__api_rate_limit_store_v1__';

type Bucket = { count: number; resetAt: number };
type RateStore = Map<string, Bucket>;

function getRateStore(): RateStore {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!g[RATE_STORE_KEY]) {
    g[RATE_STORE_KEY] = new Map<string, Bucket>();
  }
  return g[RATE_STORE_KEY] as RateStore;
}

function getAllowedOrigins(): Set<string> {
  const allowed = new Set(DEFAULT_CORS_ORIGINS);
  for (const candidate of process.env.ALLOWED_ORIGIN?.split(',') ?? []) {
    const origin = candidate.trim();
    if (origin) allowed.add(origin);
  }
  return allowed;
}

function getRequestPath(req: { url?: string; path?: string }): string {
  return req.path || req.url || '/';
}

function getClientIp(req: { headers?: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string {
  const header = req.headers?.['x-forwarded-for'];
  if (typeof header === 'string' && header.trim()) {
    return header.split(',')[0]!.trim();
  }
  if (Array.isArray(header) && header.length > 0) {
    return header[0]!.split(',')[0]!.trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

export function applyApiSecurity(
  req: {
    method?: string;
    url?: string;
    path?: string;
    headers?: Record<string, string | string[] | undefined>;
    socket?: { remoteAddress?: string };
  },
  res: {
    setHeader: (key: string, value: string) => void;
    status: (code: number) => { json: (body: unknown) => unknown };
  },
): boolean {
  const allowedOrigins = getAllowedOrigins();
  const origin = typeof req.headers?.origin === 'string' ? req.headers.origin : '';
  const allowOrigin = origin && allowedOrigins.has(origin) ? origin : '';
  res.setHeader('Vary', 'Origin');
  if (allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  }
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.status(204).json({});
    return false;
  }

  if (origin && !allowOrigin) {
    res.status(403).json({ error: 'Origin not allowed.' });
    return false;
  }

  const path = getRequestPath(req);
  if (path.includes('/admin/')) return true;

  const key = `${getClientIp(req)}:${path}`;
  const now = Date.now();
  const store = getRateStore();
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({ error: 'För många förfrågningar. Försök igen om en minut.' });
    return false;
  }

  bucket.count += 1;
  store.set(key, bucket);
  return true;
}
