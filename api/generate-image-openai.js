// api/generate-image-openai.js
// Vercel serverless function (Node 18+). Expects POST { prompt, width, height }
// Returns JSON: { image: "<base64>", mime: "image/png" } or { error: "..." }

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const prompt = (body.prompt || '').toString().trim();
    let width = parseInt(body.width || 512, 10) || 512;
    // clamp width to one of supported sizes (DALL·E / Images commonly support 256|512|1024)
    const allowed = [256, 512, 1024];
    // find nearest allowed size
    width = allowed.reduce((a,b) => Math.abs(b-width) < Math.abs(a-width) ? b : a, allowed[0]);

    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) return res.status(500).json({ error: 'Server misconfigured: OPENAI_API_KEY missing' });

    // ---- 1) Optional moderation check (recommended) ----
    // Uses OpenAI Moderation endpoint to check prompt before image generation.
    // If flagged, we reject with a friendly error.
    const modResp = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ input: prompt })
    });

    if (!modResp.ok) {
      const text = await modResp.text().catch(()=>null);
      console.error('Moderation API error', modResp.status, text);
      // don't block generation on moderation service outage — but warn
    } else {
      const modJson = await modResp.json();
      // modern moderation responses put results in `results` or `data.results`
      const results = modJson.results || modJson.results || (modJson && modJson[0] ? [modJson[0]] : []);
      if (results && results[0] && results[0].flagged) {
        return res.status(400).json({ error: 'Prompt blocked by content moderation' });
      }
    }

    // ---- 2) Image generation ----
    // Use OpenAI Images API (create). Response typically contains data[0].b64_json
    // See OpenAI docs for the exact endpoint and fields. :contentReference[oaicite:1]{index=1}
    const sizeStr = `${width}x${width}`; // e.g., "512x512"

    const imageResp = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        n: 1,
        size: sizeStr,
        // if provider supports response_format, you can set 'response_format': 'b64_json'
        // some endpoints return b64_json by default for images.
      })
    });

    if (!imageResp.ok) {
      const text = await imageResp.text().catch(()=>null);
      console.error('Images API error', imageResp.status, text);
      return res.status(502).json({ error: 'Image generation failed', details: text });
    }

    const j = await imageResp.json();

    // Typical success response: { created: ..., data: [ { b64_json: "..." } ] }
    if (j?.data && j.data[0]?.b64_json) {
      const b64 = j.data[0].b64_json;
      return res.status(200).json({ image: b64, mime: 'image/png' });
    }

    // Some OpenAI variants return a URL instead of base64.
    if (j?.data && j.data[0]?.url) {
      // fetch that URL (it may be temporary) and convert to base64
      try {
        const remote = await fetch(j.data[0].url);
        if (!remote.ok) throw new Error('Remote image fetch failed');
        const ab = await remote.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(ab);
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
        }
        const base64 = Buffer.from(binary, 'binary').toString('base64');
        return res.status(200).json({ image: base64, mime: remote.headers.get('content-type') || 'image/png' });
      } catch (err) {
        console.error('Failed to fetch remote image URL', err);
        return res.status(502).json({ error: 'Failed to fetch generated image URL' });
      }
    }

    // Unknown response shape
    console.error('Unexpected image response', j);
    return res.status(500).json({ error: 'Unexpected response from image API', details: j });

  } catch (err) {
    console.error('Server error in generate-image-openai:', err);
    return res.status(500).json({ error: 'Server error', details: err.message || String(err) });
  }
}
