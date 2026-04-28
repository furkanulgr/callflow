/**
 * n8n Proxy Routes
 *
 * LeadFlow'un n8n webhook'larına direkt erişimi CORS yüzünden engellenir.
 * Bu router gelen istekleri n8n'e iletir, response'u CORS uyumlu döner.
 *
 * Tüm /api/n8n/* istekleri n8n.lueratech.com'a forward edilir.
 *
 * Örnek:
 *   POST /api/n8n/webhook/abc-123
 *   →    https://n8n.lueratech.com/webhook/abc-123
 */

import { Router, Request, Response } from 'express';

export const n8nProxyRouter = Router();

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://n8n.vps.lueratech.com';

// Tüm HTTP method'ları kabul et
n8nProxyRouter.all('/*', async (req: Request, res: Response): Promise<void> => {
  // /api/n8n/webhook/abc → /webhook/abc
  const path = req.path;
  const targetUrl = `${N8N_BASE_URL}${path}`;

  // Query string varsa ekle
  const queryString = Object.keys(req.query).length
    ? '?' + new URLSearchParams(req.query as any).toString()
    : '';

  console.log(`[n8n-proxy] ${req.method} ${path}${queryString}`);

  try {
    // Body'yi belirle: raw body varsa onu kullan (express verify hook), yoksa JSON.stringify
    const rawBody = (req as any).rawBody as string | undefined;
    const bodyString = rawBody ?? (req.body ? JSON.stringify(req.body) : undefined);
    const hasBody = !['GET', 'HEAD'].includes(req.method) && bodyString !== undefined;

    // Header'ları kopyala — fetch'in kendi yöneteceği veya çakışan başlıkları ÇIKAR
    const skip = new Set([
      'host', 'origin', 'content-length', 'connection',
      'accept-encoding', 'transfer-encoding',
      'content-type', // bizim manuel set edeceğiz
    ]);
    const forwardHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string' && !skip.has(key.toLowerCase())) {
        forwardHeaders[key] = value;
      }
    }
    if (hasBody) {
      forwardHeaders['Content-Type'] = 'application/json';
    }

    console.log(`[n8n-proxy] Forwarding body length: ${bodyString?.length ?? 0}`);

    const response = await fetch(`${targetUrl}${queryString}`, {
      method: req.method,
      headers: forwardHeaders,
      body: hasBody ? bodyString : undefined,
      signal: AbortSignal.timeout(600_000),
    });

    // Content-Type'ı yansıt
    const contentType = response.headers.get('content-type') || 'application/json';
    res.setHeader('Content-Type', contentType);

    // Response body'yi al ve döndür
    const text = await response.text();
    res.status(response.status).send(text);

    console.log(`[n8n-proxy] ✅ ${response.status} ${path}`);
  } catch (err: any) {
    console.error(`[n8n-proxy] ❌ Hata: ${err.message}`);
    res.status(502).json({
      error: 'n8n proxy hatası',
      details: err.message,
    });
  }
});
