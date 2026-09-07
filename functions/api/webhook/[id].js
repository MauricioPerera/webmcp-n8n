export async function onRequest(context) {
  const { request, params } = context;
  const webhookId = params.id;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  let body = null;
  const contentType = request.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else if (contentType.includes('text/') || contentType.includes('application/x-www-form-urlencoded')) {
      body = await request.text();
    }
  } catch (e) {
    body = '[Unparseable body]';
  }

  const queryParams = {};
  const url = new URL(request.url);
  for (const [k, v] of url.searchParams.entries()) {
    queryParams[k] = v;
  }

  return new Response(
    JSON.stringify({
      status: 'received',
      webhookId,
      method: request.method,
      query: queryParams,
      body,
      receivedAt: new Date().toISOString(),
      colo: request.cf?.colo || 'EDGE',
      message: 'Cloudflare Pages Edge Webhook received successfully.'
    }, null, 2),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    }
  );
}
