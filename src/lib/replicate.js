import { getModelById, getVideoModelById, getI2IModelById, getI2VModelById, getV2VModelById, getLipSyncModelById } from './models.js';

// Maximum file size for data URL conversion (4MB)
const MAX_DATA_URL_FILE_SIZE = 4 * 1024 * 1024;

export class ReplicateClient {
    constructor() {
        this.baseUrl = 'https://api.replicate.com';
    }

    getKey() {
        const key = window.__REPLICATE_KEY__ || localStorage.getItem('replicate_key');
        if (!key) throw new Error('API Key missing. Please set it in Settings.');
        return key;
    }

    /**
     * Generates an image (Text-to-Image or Image-to-Image)
     * @param {Object} params
     * @param {string} params.model
     * @param {string} params.prompt
     * @param {string} params.negative_prompt
     * @param {string} params.aspect_ratio
     * @param {number} params.steps
     * @param {number} params.guidance_scale
     * @param {number} params.seed
     * @param {string} [params.image_url] - If present, treats as Image-to-Image
     */
    async generateImage(params) {
        const key = this.getKey();

        // Resolve model version from model definition
        const modelInfo = getModelById(params.model);
        const modelVersion = modelInfo?.replicateVersion || modelInfo?.endpoint || params.model;
        const url = `${this.baseUrl}/v1/predictions`;

        // Build input payload for Replicate
        const input = {
            prompt: params.prompt,
        };

        // Map aspect ratio to width/height if needed
        if (params.aspect_ratio) {
            const [w, h] = params.aspect_ratio.split(':').map(Number);
            if (w && h) {
                // Calculate dimensions maintaining aspect ratio (default to 1024px base)
                const baseSize = 1024;
                const aspectRatio = w / h;
                if (aspectRatio > 1) {
                    input.width = baseSize;
                    input.height = Math.round(baseSize / aspectRatio);
                } else {
                    input.width = Math.round(baseSize * aspectRatio);
                    input.height = baseSize;
                }
            }
        }

        // Resolution override
        if (params.resolution) {
            input.resolution = params.resolution;
        }

        // Quality
        if (params.quality) {
            input.quality = params.quality;
        }

        // Image-to-Image
        if (params.image_url) {
            input.image = params.image_url;
            input.prompt_strength = params.strength || 0.6;
        }

        // Optional params
        if (params.seed && params.seed !== -1) {
            input.seed = params.seed;
        }

        if (params.negative_prompt) {
            input.negative_prompt = params.negative_prompt;
        }

        if (params.guidance_scale) {
            input.guidance_scale = params.guidance_scale;
        }

        if (params.steps) {
            input.num_inference_steps = params.steps;
        }

        const payload = {
            version: modelVersion,
            input: input
        };

        console.log('[Replicate] Requesting:', url);
        console.log('[Replicate] Payload:', payload);

        try {
            // Step 1: Submit the task
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error('[Replicate] API Error Body:', errText);
                throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const submitData = await response.json();
            console.log('[Replicate] Submit Response:', submitData);

            // Extract prediction id for polling
            const predictionId = submitData.id;
            if (!predictionId) {
                // If result is already complete, return it
                if (submitData.output) {
                    return submitData;
                }
                throw new Error('No prediction ID returned');
            }

            // Notify caller of predictionId
            if (params.onRequestId) params.onRequestId(predictionId);

            // Step 2: Poll for results
            console.log('[Replicate] Polling for results, prediction_id:', predictionId);
            const result = await this.pollForResult(predictionId, key);

            // Normalize: extract image URL from output
            const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
            console.log('[Replicate] Image URL:', imageUrl);
            return { ...result, url: imageUrl };

        } catch (error) {
            console.error("Replicate Client Error:", error);
            throw error;
        }
    }

    /**
     * Polls the predictions endpoint until the result is ready.
     * @param {string} predictionId - The prediction ID from the submit response
     * @param {string} key - The API key
     * @param {number} maxAttempts - Maximum polling attempts (default 60 = ~2 min)
     * @param {number} interval - Polling interval in ms (default 2000)
     */
    async pollForResult(predictionId, key, maxAttempts = 60, interval = 2000) {
        const pollUrl = `${this.baseUrl}/v1/predictions/${predictionId}`;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            await new Promise(resolve => setTimeout(resolve, interval));

            console.log(`[Replicate] Polling attempt ${attempt}/${maxAttempts}...`);

            try {
                const response = await fetch(pollUrl, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${key}`
                    }
                });

                if (!response.ok) {
                    const errText = await response.text();
                    console.warn(`[Replicate] Poll error (${response.status}):`, errText);
                    // Continue polling on non-fatal errors
                    if (response.status >= 500) continue;
                    throw new Error(`Poll Failed: ${response.status} - ${errText.slice(0, 100)}`);
                }

                const data = await response.json();
                console.log('[Replicate] Poll Response:', data);

                const status = data.status?.toLowerCase();

                if (status === 'succeeded' || status === 'completed' || status === 'success') {
                    return data;
                }

                if (status === 'failed' || status === 'canceled' || status === 'cancelled') {
                    throw new Error(`Generation failed: ${data.error || 'Unknown error'}`);
                }

                // Otherwise (processing, starting, etc.) keep polling
            } catch (error) {
                if (attempt === maxAttempts) throw error;
                console.warn('[Replicate] Poll attempt failed, retrying...', error.message);
            }
        }

        throw new Error('Generation timed out after polling.');
    }

    async generateVideo(params) {
        const key = this.getKey();

        const modelInfo = getVideoModelById(params.model);
        const modelVersion = modelInfo?.replicateVersion || modelInfo?.endpoint || params.model;
        const url = `${this.baseUrl}/v1/predictions`;

        const input = {};

        if (params.prompt) input.prompt = params.prompt;
        
        // Map aspect ratio to width/height if needed
        if (params.aspect_ratio) {
            const [w, h] = params.aspect_ratio.split(':').map(Number);
            if (w && h) {
                input.aspect_ratio = params.aspect_ratio;
            }
        }
        
        if (params.duration) input.duration = params.duration;
        if (params.resolution) input.resolution = params.resolution;
        if (params.quality) input.quality = params.quality;
        if (params.mode) input.mode = params.mode;
        if (params.image_url) input.image = params.image_url;

        const payload = {
            version: modelVersion,
            input: input
        };

        console.log('[Replicate] Video Request:', url);
        console.log('[Replicate] Video Payload:', payload);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error('[Replicate] API Error Body:', errText);
                throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const submitData = await response.json();
            console.log('[Replicate] Video Submit Response:', submitData);

            const predictionId = submitData.id;
            if (!predictionId) {
                if (submitData.output) return submitData;
                throw new Error('No prediction ID returned');
            }

            if (params.onRequestId) params.onRequestId(predictionId);

            console.log('[Replicate] Polling for video results, prediction_id:', predictionId);
            const result = await this.pollForResult(predictionId, key, 900, 2000);

            const videoUrl = Array.isArray(result.output) ? result.output[0] : result.output;
            console.log('[Replicate] Video URL:', videoUrl);
            return { ...result, url: videoUrl };

        } catch (error) {
            console.error("Replicate Video Client Error:", error);
            throw error;
        }
    }

    /**
     * Generates an image using an Image-to-Image model.
     * @param {Object} params
     * @param {string} params.model - i2iModel id
     * @param {string} params.image_url - The uploaded reference image URL
     * @param {string} [params.prompt] - Optional text prompt
     * @param {string} [params.aspect_ratio]
     * @param {string} [params.resolution]
     */
    async generateI2I(params) {
        const key = this.getKey();
        const modelInfo = getI2IModelById(params.model);
        const modelVersion = modelInfo?.replicateVersion || modelInfo?.endpoint || params.model;
        const url = `${this.baseUrl}/v1/predictions`;

        const input = {};

        if (params.prompt) input.prompt = params.prompt;

        // Handle image input
        const imagesList = params.images_list?.length > 0 ? params.images_list : (params.image_url ? [params.image_url] : null);
        if (imagesList) {
            if (imagesList.length > 1) {
                input.images = imagesList;
            } else {
                input.image = imagesList[0];
            }
        }

        if (params.aspect_ratio) {
            const [w, h] = params.aspect_ratio.split(':').map(Number);
            if (w && h) {
                input.aspect_ratio = params.aspect_ratio;
            }
        }
        
        if (params.resolution) input.resolution = params.resolution;
        if (params.quality) input.quality = params.quality;

        const payload = {
            version: modelVersion,
            input: input
        };

        console.log('[Replicate] I2I Request:', url);
        console.log('[Replicate] I2I Payload:', payload);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${key}` 
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const submitData = await response.json();
            console.log('[Replicate] I2I Submit Response:', submitData);

            const predictionId = submitData.id;
            if (!predictionId) {
                if (submitData.output) return submitData;
                throw new Error('No prediction ID returned');
            }

            if (params.onRequestId) params.onRequestId(predictionId);

            const result = await this.pollForResult(predictionId, key);
            const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
            console.log('[Replicate] I2I Result URL:', imageUrl);
            return { ...result, url: imageUrl };
        } catch (error) {
            console.error('Replicate I2I Error:', error);
            throw error;
        }
    }

    /**
     * Generates a video using an Image-to-Video model.
     * @param {Object} params
     * @param {string} params.model - i2vModel id
     * @param {string} params.image_url - The uploaded start frame image URL
     * @param {string} [params.prompt]
     * @param {string} [params.aspect_ratio]
     * @param {string} [params.resolution]
     * @param {number} [params.duration]
     * @param {string} [params.quality]
     */
    async generateI2V(params) {
        const key = this.getKey();
        const modelInfo = getI2VModelById(params.model);
        const modelVersion = modelInfo?.replicateVersion || modelInfo?.endpoint || params.model;
        const url = `${this.baseUrl}/v1/predictions`;

        const input = {};

        if (params.prompt) input.prompt = params.prompt;
        if (params.image_url) input.image = params.image_url;
        if (params.aspect_ratio) input.aspect_ratio = params.aspect_ratio;
        if (params.duration) input.duration = params.duration;
        if (params.resolution) input.resolution = params.resolution;
        if (params.quality) input.quality = params.quality;
        if (params.mode) input.mode = params.mode;

        const payload = {
            version: modelVersion,
            input: input
        };

        console.log('[Replicate] I2V Request:', url);
        console.log('[Replicate] I2V Payload:', payload);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${key}` 
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const submitData = await response.json();
            console.log('[Replicate] I2V Submit Response:', submitData);

            const predictionId = submitData.id;
            if (!predictionId) {
                if (submitData.output) return submitData;
                throw new Error('No prediction ID returned');
            }

            if (params.onRequestId) params.onRequestId(predictionId);

            const result = await this.pollForResult(predictionId, key, 900, 2000);
            const videoUrl = Array.isArray(result.output) ? result.output[0] : result.output;
            console.log('[Replicate] I2V Result URL:', videoUrl);
            return { ...result, url: videoUrl };
        } catch (error) {
            console.error('Replicate I2V Error:', error);
            throw error;
        }
    }

    /**
     * Uploads a file to a temporary storage and returns a URL.
     * Note: Replicate doesn't have a direct file upload endpoint.
     * Files need to be hosted externally or use data URLs for small files.
     * @param {File} file - The image file to upload
     * @returns {Promise<string>} The hosted URL of the uploaded file
     */
    async uploadFile(file) {
        // Replicate doesn't provide file upload - convert to data URL for small files
        // For production, you'd want to host files on your own CDN or use a service like S3
        
        return new Promise((resolve, reject) => {
            if (file.size > MAX_DATA_URL_FILE_SIZE) {
                reject(new Error(`File too large for data URL (max ${MAX_DATA_URL_FILE_SIZE / (1024 * 1024)}MB). Please use an external CDN.`));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                console.log('[Replicate] File converted to data URL:', file.name);
                resolve(e.target.result);
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Video-to-Video generation
     */
    async generateV2V(params) {
        const key = this.getKey();
        const modelInfo = getV2VModelById(params.model);
        const modelVersion = modelInfo?.replicateVersion || modelInfo?.endpoint || params.model;
        const url = `${this.baseUrl}/v1/predictions`;

        const input = {};
        if (params.prompt) input.prompt = params.prompt;
        if (params.video_url) input.video = params.video_url;
        if (params.strength) input.strength = params.strength;

        const payload = {
            version: modelVersion,
            input: input
        };

        console.log('[Replicate] V2V Request:', url);
        console.log('[Replicate] V2V Payload:', payload);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const submitData = await response.json();
            const predictionId = submitData.id;
            if (!predictionId) {
                if (submitData.output) return submitData;
                throw new Error('No prediction ID returned');
            }

            if (params.onRequestId) params.onRequestId(predictionId);

            const result = await this.pollForResult(predictionId, key, 900, 2000);
            const videoUrl = Array.isArray(result.output) ? result.output[0] : result.output;
            return { ...result, url: videoUrl };
        } catch (error) {
            console.error('Replicate V2V Error:', error);
            throw error;
        }
    }

    /**
     * Lip sync generation
     */
    async processLipSync(params) {
        const key = this.getKey();
        const modelInfo = getLipSyncModelById(params.model);
        const modelVersion = modelInfo?.replicateVersion || modelInfo?.endpoint || params.model;
        const url = `${this.baseUrl}/v1/predictions`;

        const input = {};
        if (params.audio_url) input.audio = params.audio_url;
        if (params.image_url) input.image = params.image_url;
        if (params.video_url) input.video = params.video_url;
        if (params.prompt) input.prompt = params.prompt;

        const payload = {
            version: modelVersion,
            input: input
        };

        console.log('[Replicate] LipSync Request:', url);
        console.log('[Replicate] LipSync Payload:', payload);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const submitData = await response.json();
            const predictionId = submitData.id;
            if (!predictionId) {
                if (submitData.output) return submitData;
                throw new Error('No prediction ID returned');
            }

            if (params.onRequestId) params.onRequestId(predictionId);

            const result = await this.pollForResult(predictionId, key, 900, 2000);
            const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output;
            return { ...result, url: outputUrl };
        } catch (error) {
            console.error('Replicate LipSync Error:', error);
            throw error;
        }
    }
}

// Export a default instance for convenience
export default new ReplicateClient();
