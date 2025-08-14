// generate-image-openai.js

/**
 * Generate images using OpenAI's DALL-E API
 * 
 * @param {Object} params - Generation parameters
 * @param {string} params.apiKey - OpenAI API key
 * @param {string} params.prompt - Image generation prompt
 * @param {number} [params.n=1] - Number of images to generate (1-4)
 * @param {string} [params.size="512x512"] - Image size
 * @param {string} [params.quality="standard"] - Image quality (standard/hd)
 * @param {string} [params.style="natural"] - Image style (vivid/natural)
 * @param {string} [params.model="dall-e-2"] - Model to use (dall-e-2/dall-e-3)
 * @returns {Promise<Array>} Array of image URLs
 */
async function generateImagesWithOpenAI(params) {
    // Validate parameters
    if (!params.apiKey) throw new Error('API key is required');
    if (!params.prompt) throw new Error('Prompt is required');
    
    // Set defaults
    const n = params.n || 1;
    const size = params.size || "512x512";
    const quality = params.quality || "standard";
    const style = params.style || "natural";
    const model = params.model || "dall-e-2";
    
    // Validate input ranges
    if (n < 1 || n > 4) throw new Error('Number of images must be between 1 and 4');
    
    // Build request body
    const requestBody = {
        model: model,
        prompt: params.prompt,
        n: n,
        size: size,
        response_format: "url"
    };
    
    // Add DALL-E 3 specific parameters
    if (model === "dall-e-3") {
        requestBody.quality = quality;
        requestBody.style = style;
    }
    
    try {
        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${params.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
        }
        
        const data = await response.json();
        return data.data.map(img => img.url);
    } catch (error) {
        throw new Error(`API request failed: ${error.message}`);
    }
}

// Export for Node.js environment if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = generateImagesWithOpenAI;
}
