/**
 * Cloudflare Worker: livetech-claude-proxy
 *
 * Required secrets (match what's already in your Cloudflare Worker):
 *   ANTHROPIC_KEY                — Anthropic API key
 *   CLICKUP_KEY                  — ClickUp personal API token
 *   MAKE_API_TOKEN               — Make.com API token
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL — Google service account email
 *   GOOGLE_PRIVATE_KEY           — Google service account private key (RSA PEM)
 *   (optional) GOOGLE_SA_JSON    — Full service account JSON (overrides the two above)
 *
 * Routes:
 *   POST /              → Claude Anthropic API proxy
 *   * /clickup/*        → ClickUp v2 read proxy
 *   POST /clickup-write/* → ClickUp v2 write proxy
 *   POST /bigquery      → BigQuery synchronous query
 *   POST /gsc-inspect   → Google Search Console URL Inspection (batched, up to 100 URLs)
 *   GET  /make/*        → Make.com API proxy
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';

    try {
      if (request.method === 'POST' && path === '/') return handleClaude(request, env);
      if (path.startsWith('/clickup-write/'))        return handleClickUpWrite(request, env, path);
      if (path.startsWith('/clickup/'))              return handleClickUp(request, env, url, path);
      if (request.method === 'POST' && path === '/bigquery')    return handleBigQuery(request, env);
      if (request.method === 'POST' && path === '/gsc-inspect') return handleGscInspect(request, env);
      if (path.startsWith('/make/'))                 return handleMake(request, env, url, path);
      if (path === '/make-debug')                    return handleMakeDebug(request, env);

      return new Response('Not found', { status: 404, headers: CORS });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
  },
};

// ── Google service-account JWT auth ──────────────────────

async function getGoogleToken(env, scopes) {
  let email, rawKey;

  if (env.GOOGLE_SA_JSON) {
    // Full JSON key file stored as one secret (optional, newer setup)
    const sa = JSON.parse(env.GOOGLE_SA_JSON);
    email  = sa.client_email;
    rawKey = sa.private_key;
  } else {
    // Existing secrets: GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY
    email  = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    rawKey = env.GOOGLE_PRIVATE_KEY;
  }

  if (!email || !rawKey) {
    throw new Error('Google service account not configured. Expected GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY secrets.');
  }

  const now = Math.floor(Date.now() / 1000);
  const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: email,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const sigInput = `${header}.${payload}`;

  // Import RSA private key
  const pem     = rawKey.replace(/\\n/g, '\n');
  const keyBody = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const keyDer  = Uint8Array.from(atob(keyBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyDer.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  );

  const sigBytes = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(sigInput),
  );
  const jwt = `${sigInput}.${b64urlBytes(new Uint8Array(sigBytes))}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!tokenRes.ok) throw new Error(`Google auth failed: ${await tokenRes.text()}`);
  const { access_token } = await tokenRes.json();
  return access_token;
}

function b64url(str)        { return btoa(str).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }
function b64urlBytes(bytes)  { return btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }

// ── Claude proxy ──────────────────────────────────────────

async function handleClaude(request, env) {
  const body = await request.text();
  const res  = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': env.ANTHROPIC_KEY,
    },
    body,
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ── ClickUp read proxy ────────────────────────────────────

async function handleClickUp(request, env, url, path) {
  const cuPath = path.replace(/^\/clickup\//, '');
  const cuUrl  = `https://api.clickup.com/api/v2/${cuPath}${url.search}`;
  const res    = await fetch(cuUrl, {
    method:  request.method,
    headers: { 'Authorization': env.CLICKUP_KEY, 'Content-Type': 'application/json' },
    body:    ['GET','HEAD'].includes(request.method) ? undefined : await request.text(),
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ── ClickUp write proxy ───────────────────────────────────

async function handleClickUpWrite(request, env, path) {
  const cuPath = path.replace(/^\/clickup-write\//, '');
  const body   = ['GET','HEAD'].includes(request.method) ? undefined : await request.text();
  const res    = await fetch(`https://api.clickup.com/api/v2/${cuPath}`, {
    method:  request.method,
    headers: { 'Authorization': env.CLICKUP_KEY, 'Content-Type': 'application/json' },
    body,
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ── BigQuery ──────────────────────────────────────────────

async function handleBigQuery(request, env) {
  const { projectId, region, query } = await request.json();
  const token = await getGoogleToken(env, ['https://www.googleapis.com/auth/bigquery.readonly']);

  const res = await fetch(
    `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries?location=${region}`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, useLegacySql: false, timeoutMs: 30000, location: region }),
    },
  );
  return new Response(await res.text(), {
    status: res.status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ── GSC URL Inspection ────────────────────────────────────
// Accepts: { siteUrl: string, urls: string[] }
// Returns: [{ url, verdict, coverageState, robotsTxtState, indexingState, lastCrawlTime, error }]

async function handleGscInspect(request, env) {
  const { siteUrl, urls } = await request.json();
  if (!siteUrl) throw new Error('siteUrl is required');
  if (!Array.isArray(urls) || urls.length === 0) {
    return new Response(JSON.stringify([]), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  const token          = await getGoogleToken(env, ['https://www.googleapis.com/auth/webmasters.readonly']);
  const urlsToInspect  = urls.slice(0, 100);   // cap at 100 — GSC quota is 2000/day
  const results        = [];
  const BATCH          = 5;                     // concurrent requests per batch

  for (let i = 0; i < urlsToInspect.length; i += BATCH) {
    const batch = urlsToInspect.slice(i, i + BATCH);

    const batchResults = await Promise.all(batch.map(async (inspectionUrl) => {
      try {
        const res = await fetch(
          'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
          {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ inspectionUrl, siteUrl }),
          },
        );

        if (!res.ok) {
          const errText = await res.text();
          return { url: inspectionUrl, error: `GSC ${res.status}: ${errText.slice(0, 300)}` };
        }

        const data        = await res.json();
        const ir          = data.inspectionResult  || {};
        const idx         = ir.indexStatusResult   || {};

        return {
          url:            inspectionUrl,
          verdict:        ir.overallVerdict         || idx.verdict       || null,
          coverageState:  idx.coverageState                               || null,
          robotsTxtState: idx.robotsTxtState                              || null,
          indexingState:  idx.indexingState                               || null,
          lastCrawlTime:  idx.lastCrawlTime                               || null,
          error:          null,
        };
      } catch (e) {
        return { url: inspectionUrl, error: e.message };
      }
    }));

    results.push(...batchResults);

    // Brief pause between batches to stay within per-second quota
    if (i + BATCH < urlsToInspect.length) {
      await new Promise(r => setTimeout(r, 250));
    }
  }

  return new Response(JSON.stringify(results), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ── Make.com API proxy ────────────────────────────────────

async function handleMake(request, env, url, path) {
  const makePath = path.replace(/^\/make\//, '');
  const qs       = url.search;
  const body     = ['GET','HEAD'].includes(request.method) ? undefined : await request.text();

  // Try both auth header formats × all regions (6 combinations)
  // Older Make.com (Integromat) used X-Imt-Api-Key; newer uses Authorization: Token
  const authHeaders = [
    { 'Authorization': `Token ${env.MAKE_API_TOKEN}`, 'Content-Type': 'application/json' },
    { 'X-Imt-Api-Key': env.MAKE_API_TOKEN, 'Content-Type': 'application/json' },
  ];
  const bases = ['https://eu1.make.com/api/v2', 'https://us1.make.com/api/v2', 'https://us2.make.com/api/v2'];
  let lastStatus = 0, lastBody = '';

  for (const headers of authHeaders) {
    for (const base of bases) {
      const res  = await fetch(`${base}/${makePath}${qs}`, { method: request.method, headers, body });
      const text = await res.text();
      if (res.status !== 401) {
        return new Response(text, { status: res.status, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
      lastStatus = res.status;
      lastBody   = text;
    }
  }

  return new Response(JSON.stringify({ error: `Make.com auth failed on all regions/formats`, detail: lastBody }), {
    status: lastStatus,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ── Make.com debug — visit /make-debug in browser to diagnose ─
async function handleMakeDebug(request, env) {
  const token = env.MAKE_API_TOKEN || '';
  const results = {};

  const authVariants = [
    ['Authorization: Token', { 'Authorization': `Token ${token}` }],
    ['X-Imt-Api-Key',        { 'X-Imt-Api-Key': token }],
  ];
  const bases = ['https://eu1.make.com/api/v2', 'https://us1.make.com/api/v2', 'https://us2.make.com/api/v2'];

  // Test 1: /users/me — basic auth check (no special scope needed)
  for (const [label, headers] of authVariants) {
    for (const base of bases) {
      const key = `${label} @ ${base}`;
      try {
        const r = await fetch(`${base}/users/me`, { headers });
        results[key] = { status: r.status, body: (await r.text()).slice(0, 300) };
      } catch(e) { results[key] = { error: e.message }; }
    }
  }

  // Test 2: data store endpoint with whichever auth worked
  const workingAuth = authVariants.find(([label]) => Object.entries(results).some(([k,v]) => k.startsWith(label) && v.status === 200));
  if (workingAuth) {
    const [label, headers] = workingAuth;
    for (const base of bases) {
      try {
        const r = await fetch(`${base}/data-stores/157873/data-store-records?teamId=583475&limit=1`, { headers });
        results[`datastore @ ${base}`] = { status: r.status, body: (await r.text()).slice(0, 300) };
      } catch(e) { results[`datastore @ ${base}`] = { error: e.message }; }
    }
  }

  return new Response(JSON.stringify({
    tokenLength: token.length,
    tokenPreview: token ? token.slice(0,4) + '...' + token.slice(-4) : 'MISSING',
    results
  }, null, 2), { headers: { ...CORS, 'Content-Type': 'application/json' } });
}
