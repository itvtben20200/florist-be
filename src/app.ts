import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { config } from './config';
import { errorHandler } from './middleware/error.middleware';
import router from './routes';

const app = express();

// ── Trust proxy (required for Railway, Heroku, etc.) ───────────────────────
app.set('trust proxy', 1);

// ── Security ───────────────────────────────────────────────────────────────
app.use(helmet());
// In development, allow both 3000 and 3001 (Next.js auto-picks available port)
const allowedOrigins = config.nodeEnv === 'development'
  ? ['http://localhost:3000', 'http://localhost:3001']
  : config.frontendUrl;
app.use(cors({ origin: allowedOrigins, credentials: true }));

// ── Global rate limit ──────────────────────────────────────────────────────
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ── Auth routes get stricter rate limiting ─────────────────────────────────
// Skip in test mode so automated test suites don't exhaust the 20-req/15min quota
if (config.nodeEnv !== 'test') {
  app.use(
    '/api/auth',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      message: { error: 'Too many requests, please try again later.' },
    })
  );
}

// ── Body parsing ───────────────────────────────────────────────────────────
// Stripe webhooks require raw body — must be registered before json()
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api', router);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Error handler (must be last) ───────────────────────────────────────────
app.use(errorHandler);

export default app;
