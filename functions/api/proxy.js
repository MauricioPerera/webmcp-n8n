export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!targetUrl) {
    return new Response(
      JSON.stringify({ error: 'Missing "url" query parameter. Example: /api/proxy?url=https://api.example.com/data' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const parsedTarget = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsedTarget.protocol)) {
      return new Response(
        JSON.stringify({ error: 'Only http and https protocols are supported' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const forwardHeaders = new Headers();
    for (const [key, value] of request.headers.entries()) {
      const lower = key.toLowerCase();
      if (!['host', 'cf-ray', 'cf-connecting-ip', 'cf-ipcountry', 'x-real-ip'].includes(lower)) {
        forwardHeaders.set(key, value);
      }
    }

    const fetchOptions = {
      method: request.method,
      headers: forwardHeaders,
      redirect: 'follow'
    };

    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const body = await request.arrayBuffer();
      if (body.byteLength > 0) {
        fetchOptions.body = body;
      }
    }

    const response = await fetch(targetUrl, fetchOptions);

    const responseHeaders = new Headers(response.headers);
    for (const [k, v] of Object.entries(corsHeaders)) {
      responseHeaders.set(k, v);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Proxy request failed', message: err.message }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
