// /api/generate-image-openai.js
// Vercel serverless function (CommonJS).
// Uses env var: Monadicons_Key
// Expects POST { prompt: string, width?: number, height?: number }
// Returns JSON: { image: "<base64 PNG data (no data URL)>" }

module.exports = async (req, res) => {
  try {
    console.log("[generate-image-openai] invocation", { method: req.method });

    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    // parse body safely (Vercel usually populates req.body)
    let body = req.body;
    if (!body) {
      try {
        const raw = await new Promise((resolve) => {
          let data = "";
          req.on("data", chunk => (data += chunk));
          req.on("end", () => resolve(data));
        });
        body = raw ? JSON.parse(raw) : {};
      } catch (e) {
        console.warn("[generate-image-openai] body parse failed:", e && e.message);
        body = {};
      }
    }

    const prompt = (body.prompt || "").toString().trim();
    const width = parseInt(body.width || body.w || body.size || 512, 10) || 512;
    const height = parseInt(body.height || body.h || body.size || 512, 10) || width;

    console.log("[generate-image-openai] request body:", { prompt: !!prompt, width, height });

    if (!prompt) {
      return res.status(400).json({ error: "Missing `prompt` in request body." });
    }

    const OPENAI_KEY = process.env.Monadicons_Key;
    if (!OPENAI_KEY) {
      console.error("[generate-image-openai] missing env var Monadicons_Key");
      return res.status(500).json({ error: "OpenAI key not configured. Set env var Monadicons_Key in Vercel." });
    }

    // clamp sizes (OpenAI may impose limits)
    const w = Math.max(64, Math.min(2048, width));
    const h = Math.max(64, Math.min(2048, height));
    const size = `${w}x${h}`;

    // Build request payload — do NOT include response_format here
    const payload = {
      model: "gpt-image-1",
      prompt,
      size
    };

    console.log("[generate-image-openai] calling openai/images/generations with payload:", payload);

    const openaiResp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const status = openaiResp.status;
    const contentType = openaiResp.headers.get("content-type") || "";

    // Try to parse JSON (OpenAI usually returns JSON)
    let respJson = null;
    try {
      respJson = await openaiResp.json();
    } catch (e) {
      // not JSON
      console.warn("[generate-image-openai] response not json", e && e.message);
    }

    if (!openaiResp.ok) {
      console.error("[generate-image-openai] OpenAI API error:", respJson || { status, contentType });
      return res.status(status || 500).json({ error: "OpenAI API error", details: respJson || { status, contentType } });
    }

    // data may contain b64_json or url
    const first = respJson && respJson.data && respJson.data[0] ? respJson.data[0] : null;

    if (!first) {
      console.error("[generate-image-openai] unexpected response shape:", respJson);
      return res.status(500).json({ error: "Unexpected OpenAI response", details: respJson });
    }

    // If b64_json present, return it directly
    if (first.b64_json) {
      console.log("[generate-image-openai] got b64_json from OpenAI");
      return res.status(200).json({ image: first.b64_json });
    }

    // If a URL is returned, fetch and convert to base64
    if (first.url) {
      console.log("[generate-image-openai] got url from OpenAI, fetching:", first.url);
      const imgResp = await fetch(first.url);
      if (!imgResp.ok) {
        console.error("[generate-image-openai] failed to fetch image URL:", imgResp.status);
        return res.status(500).json({ error: "Failed to fetch image URL", details: { url: first.url, status: imgResp.status } });
      }
      const arrayBuffer = await imgResp.arrayBuffer();
      const b64 = Buffer.from(arrayBuffer).toString("base64");
      return res.status(200).json({ image: b64 });
    }

    console.error("[generate-image-openai] no image returned (no b64_json or url)", respJson);
    return res.status(500).json({ error: "No image returned from OpenAI", details: respJson });
  } catch (err) {
    console.error("[generate-image-openai] server error:", err && (err.stack || err.message || String(err)));
    return res.status(500).json({ error: "Server error", details: String(err) });
  }
};
