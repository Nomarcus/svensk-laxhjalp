import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import express from 'express';

loadEnv();
// Local overrides (gitignored); wins over .env so ADMIN_EMAIL etc. work without editing .env
loadEnv({ path: resolve(process.cwd(), '.env.local'), override: true });
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth';
import { subscriptionMiddleware } from './middleware/subscription';
import { aiRouter } from './routes/ai';
import { ttsRouter } from './routes/tts';
import { billingRouter, stripeWebhookHandler } from './routes/billing';
import { adminRouter } from './routes/admin';

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 3001;

// CRITICAL: Stripe webhook MUST come before express.json() — needs raw body
app.post('/webhook/stripe', express.raw({ type: 'application/json' }), stripeWebhookHandler);

const allowedOrigins = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN.split(',')
  : ['http://localhost:3000'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json({ limit: '5mb' }));

// Health check (no auth required)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'För många förfrågningar. Försök igen om en minut.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);
app.use('/api', authMiddleware);
app.use('/api', billingRouter);           // After auth, before subscription check
app.use('/api', adminRouter);             // Sole-owner analytics (requires ADMIN_UID)
app.use('/api', subscriptionMiddleware);  // After billing, before AI routes
app.use('/api', ttsRouter);
app.use('/api', aiRouter);

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

export default app;
