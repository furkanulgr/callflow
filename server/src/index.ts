/**
 * CallFlow Bridge Server — Sadelik Sürümü
 *
 * ElevenLabs native Twilio entegrasyonu sayesinde
 * WebSocket bridge gerekmez. Sadece HTTP server yeterli.
 */

import * as Sentry from '@sentry/node';

// Sentry — diğer importlardan ÖNCE init edilmeli
const SENTRY_DSN = process.env.SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
  console.log('[Sentry] Error tracking aktif');
}

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { callsRouter } from './routes/calls';
import { webhooksRouter } from './routes/webhooks';
import { leadflowRouter } from './routes/leadflow';
import { n8nProxyRouter } from './routes/n8n-proxy';
import { inboundRouter } from './routes/inbound';
import { twilioRouter } from './routes/twilio';
import { whatsappRouter } from './routes/whatsapp';
import { requireAuth } from './middleware/auth';

const app = express();

// Sentry handler express app'e bağlanır (sadece DSN varsa)
if (SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// ─── Middleware ────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:5174'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const callLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many call requests, please try again later.' },
});

app.use(globalLimiter);

// Raw body'yi yakala — webhook HMAC doğrulaması için gerekli
app.use(express.json({
  verify: (req, _res, buf) => {
    (req as any).rawBody = buf.toString('utf8');
  },
}));
app.use(express.urlencoded({ extended: false }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/calls',     callLimiter, requireAuth, callsRouter);
app.use('/api/inbound',   requireAuth, inboundRouter);
app.use('/api/whatsapp',  requireAuth, whatsappRouter);
app.use('/webhooks',      webhooksRouter);          // kendi HMAC doğrulaması var
app.use('/api/leadflow',  leadflowRouter);          // kendi API key doğrulaması var
app.use('/api/n8n',       requireAuth, n8nProxyRouter);
app.use('/',              twilioRouter);            // /twiml/* — Twilio webhook'ları

// Health check
app.get('/health', async (_req, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
    const { error } = await supabase.from('campaigns').select('id').limit(1);
    if (error) throw error;
    res.json({
      status:    'ok',
      service:   'callflow-server',
      timestamp: new Date().toISOString(),
      version:   '2.0.0',
      db:        'connected',
    });
  } catch {
    res.status(503).json({
      status:    'degraded',
      service:   'callflow-server',
      timestamp: new Date().toISOString(),
      db:        'error',
    });
  }
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler — unhandled Express errors
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (SENTRY_DSN) Sentry.captureException(err);
  console.error('[Server] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Başlat ───────────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║       CallFlow Server v2.0.0                 ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  HTTP → http://localhost:${config.port}               ║`);
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  POST /api/calls/outbound                    ║');
  console.log('║  POST /api/calls/batch                       ║');
  console.log('║  GET  /api/calls/active                      ║');
  console.log('║  POST /api/whatsapp/send                     ║');
  console.log('║  POST /api/whatsapp/batch                    ║');
  console.log('║  GET  /api/whatsapp/status                   ║');
  console.log('║  POST /webhooks/elevenlabs                   ║');
  console.log('║  GET  /health                                ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT',  () => process.exit(0));

export { app };
