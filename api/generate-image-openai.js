// Place this file at: /api/generate-image-openai.js (root of your Vercel project)
//
// Uses the environment variable: Monadicons_Key
// Returns JSON: { image: "data:image/png;base64,...." }

const { TextDecoder } = require("util");

module.exports = async (req, res) => {
  try {
    // Only allow POST
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    // Ensure body parsed (Vercel auto-parses JSON, but guard anyway)
    let body = req.body;
    if (!body) {
      // try parse raw
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
    const size = body.size || "512x512";

    if (!prompt) return res.status(400).json({ error: "Missing `prompt` in request body." });

    const OPENAI_KEY = process.env.Monadicons_Key;
    if (!OPENAI_KEY) return res.status(500).json({ error: "OpenAI key not configured (Monadicons_Key)." });

    // Call OpenAI Images endpoint and ask for base64 response
    const openaiResp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: prompt,
        size: size,
        response_format: "b64_json", // request base64 for easy browser preview
      }),
    });

    const data = await openaiResp.json();

    if (!openaiResp.ok) {
      // Forward OpenAI error info for debugging
      console.error("OpenAI error:", data);
      return res.status(openaiResp.status || 500).json({ error: "OpenAI API error", details: data });
    }

    // Extract base64 result
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      console.error("Unexpected OpenAI response:", data);
      return res.status(500).json({ error: "No image returned from OpenAI", details: data });
    }

    const dataUrl = `data:image/png;base64,${b64}`;
    return res.status(200).json({ image: dataUrl });
  } catch (err) {
    console.error("Server error in /api/generate-image-openai:", err);
    return res.status(500).json({ error: "Server error", details: String(err) });
  }
};
