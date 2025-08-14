// /api/generate-image-openai.js
// Vercel serverless function. Uses env var Monadicons_Key.
// Expects POST { prompt: string, width?: number, height?: number }
// Returns { image: "<base64-encoded-png-without-dataurl>" }

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    // Parse body (Vercel usually populates req.body)
    let body = req.body;
    if (!body) {
      try {
        const raw = await new Promise((resolve) => {
          let data = "";
          req.on("data", (chunk) => (data += chunk));
          req.on("end", () => resolve(data));
        });
        body = raw ? JSON.parse(raw) : {};
      } catch (e) {
        body = {};
      }
    }

    const prompt = (body.prompt || "").toString().trim();
    const width = parseInt(body.width || body.w || body.size || 512, 10) || 512;
    const height = parseInt(body.height || body.h || body.size || 512, 10) || 512;

    if (!prompt) {
      return res.status(400).json({ error: "Missing `prompt` in request body." });
    }

    const OPENAI_KEY = process.env.Monadicons_Key;
    if (!OPENAI_KEY) {
      return res.status(500).json({ error: "OpenAI key not configured. Set env var Monadicons_Key in Vercel." });
    }

    // Clamp to safe bounds the API supports (keep reasonable)
    const w = Math.max(64, Math.min(2048, width));
    const h = Math.max(64, Math.min(2048, height));
    const size = `${w}x${h}`;

    // Call OpenAI Images endpoint and request base64 response
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size,
        response_format: "b64_json"
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);
      return res.status(response.status || 500).json({ error: "OpenAI API error", details: data });
    }

    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      console.error("Unexpected OpenAI response:", data);
      return res.status(500).json({ error: "No image returned from OpenAI", details: data });
    }

    // Return base64 only (frontend will add data:image/png;base64,)
    return res.status(200).json({ image: b64 });
  } catch (err) {
    console.error("Server error in /api/generate-image-openai:", err);
    return res.status(500).json({ error: "Server error", details: String(err) });
  }
};
