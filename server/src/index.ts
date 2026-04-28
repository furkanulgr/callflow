/**
 * CallFlow Bridge Server — Sadelik Sürümü
 *
 * ElevenLabs native Twilio entegrasyonu sayesinde
 * WebSocket bridge gerekmez. Sadece HTTP server yeterli.
 */

import express from 'express';
import cors from 'cors';
import { config } from './config';
import { callsRouter } from './routes/calls';
import { webhooksRouter } from './routes/webhooks';
import { leadflowRouter } from './routes/leadflow';
import { n8nProxyRouter } from './routes/n8n-proxy';

const app = express();

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://callflow.lueratech.com',
    'https://leadflow.lueratech.com',
  ],
  credentials: true,
}));

// Raw body'yi yakala — webhook HMAC doğrulaması için gerekli
app.use(express.json({
  verify: (req, _res, buf) => {
    (req as any).rawBody = buf.toString('utf8');
  },
}));
app.use(express.urlencoded({ extended: false }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/calls',    callsRouter);
app.use('/webhooks',     webhooksRouter);
app.use('/api/leadflow', leadflowRouter);
app.use('/api/n8n',      n8nProxyRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    service:   'callflow-server',
    timestamp: new Date().toISOString(),
    version:   '2.0.0',
  });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
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
  console.log('║  GET  /api/calls/phone-numbers               ║');
  console.log('║  POST /webhooks/elevenlabs                   ║');
  console.log('║  GET  /health                                ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT',  () => process.exit(0));

export { app };
