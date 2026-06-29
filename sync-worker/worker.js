function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function sha256Hex(str) {
  const bytes = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyWriteToken(verifyKeyHex, writeTokenHex) {
  try {
    const keyBytes = hexToBytes(verifyKeyHex);
    const hmacKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const expectedWriteTokenBytes = await crypto.subtle.sign(
      'HMAC',
      hmacKey,
      new TextEncoder().encode('nid-write-auth')
    );
    const expectedWriteToken = Array.from(new Uint8Array(expectedWriteTokenBytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return expectedWriteToken === writeTokenHex;
  } catch (e) {
    return false;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const match = path.match(/^\/v1\/([a-f0-9]+)$/i);
    const address = match ? match[1] : null;

    if (!address) {
      return new Response(JSON.stringify({ error: 'not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET handler
    if (request.method === 'GET') {
      const entryStr = await env.NOTES_KV.get(address);
      if (!entryStr) {
        return new Response(JSON.stringify({ error: 'not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const entry = JSON.parse(entryStr);
      return new Response(
        JSON.stringify({
          blob: entry.blob,
          blobHash: entry.blobHash,
          updatedAt: entry.updatedAt,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // PUT handler
    if (request.method === 'PUT') {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { blob, writeToken, verifyKey, previousHash } = body;
      if (!blob || !writeToken) {
        return new Response(JSON.stringify({ error: 'Missing blob or writeToken' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const existingEntryStr = await env.NOTES_KV.get(address);

      if (!existingEntryStr) {
        // First write
        if (!verifyKey) {
          return new Response(JSON.stringify({ error: 'Missing verifyKey for first write' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const blobHash = await sha256Hex(blob);
        const entry = {
          blob,
          blobHash,
          verifyKey,
          updatedAt: new Date().toISOString(),
        };

        await env.NOTES_KV.put(address, JSON.stringify(entry));
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Subsequent write
      const existingEntry = JSON.parse(existingEntryStr);
      const isAuthorized = await verifyWriteToken(existingEntry.verifyKey, writeToken);

      if (!isAuthorized) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Compare and swap conflict check
      if (previousHash !== undefined && previousHash !== null && previousHash !== existingEntry.blobHash) {
        return new Response(
          JSON.stringify({ error: 'conflict', currentHash: existingEntry.blobHash }),
          {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const blobHash = await sha256Hex(blob);
      const updatedEntry = {
        blob,
        blobHash,
        verifyKey: existingEntry.verifyKey,
        updatedAt: new Date().toISOString(),
      };

      await env.NOTES_KV.put(address, JSON.stringify(updatedEntry));
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Method Not Allowed
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};
