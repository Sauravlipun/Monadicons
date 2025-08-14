// api/generate-image-xai.js
// Vercel serverless function for xAI integration

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const prompt = (body.prompt || '').toString().trim();
    let width = parseInt(body.width || 512, 10) || 512;
    
    // Validate inputs
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
    if (width < 256 || width > 1024) width = 512; // Enforce xAI size limits

    const XAI_KEY = process.env.XAI_API_KEY;
    if (!XAI_KEY) return res.status(500).json({ error: 'Server misconfigured: XAI_API_KEY missing' });

    // ---- xAI Image Generation ----
    // Note: xAI API endpoint and parameters are different from OpenAI
    const sizeStr = `${width}x${width}`;
    
    const response = await fetch('https://api.x.ai/v1', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${XAI_KEY}`,
        'Content-Type': 'application/json',
        'x-api-version': '2024-06-01' // Example version, check docs
      },
      body: JSON.stringify({
        prompt: prompt,
        model: "vision", // Example model name
        size: sizeStr,
        quality: "standard",
        style: "vivid",
        n: 1,
        response_format: "b64_json"
      })
    });

    // Handle xAI API response
    if (!response.ok) {
      const errorText = await response.text();
      console.error('xAI API error', response.status, errorText);
      return res.status(502).json({ 
        error: 'xAI image generation failed',
        details: errorText.slice(0, 200) 
      });
    }

    const responseData = await response.json();
    
    // Parse xAI response (structure may differ)
    const imageData = responseData.data?.[0]?.b64_json || 
                     responseData.images?.[0]?.b64_data;
    
    if (!imageData) {
      console.error('Invalid xAI response', responseData);
      return res.status(500).json({ 
        error: 'Invalid response from xAI API',
        details: 'Missing image data' 
      });
    }

    return res.status(200).json({ 
      image: imageData, 
      mime: 'image/png' 
    });

  } catch (err) {
    console.error('Server error in generate-image-xai:', err);
    return res.status(500).json({ 
      error: 'Server error', 
      details: err.message || String(err) 
    });
  }
}
