export async function onRequest(context) {
  const { request } = context;
  const cf = request.cf || {};

  const info = {
    status: 'ok',
    service: 'webmcp-n8n Edge Runtime',
    platform: 'Cloudflare Pages Functions',
    timestamp: new Date().toISOString(),
    edge: {
      colo: cf.colo || 'LOCAL',
      country: cf.country || 'UNKNOWN',
      city: cf.city || 'UNKNOWN',
      timezone: cf.timezone || 'UTC',
      httpProtocol: cf.httpProtocol || 'HTTP/2',
      rayId: request.headers.get('cf-ray') || null
    },
    capabilities: [
      'Edge CORS Proxy (/api/proxy?url=...)',
      '24/7 Inbound Webhooks (/api/webhook/:id)',
      'Sub-10ms Global CDN Latency'
    ]
  };

  return new Response(JSON.stringify(info, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    }
  });
}
