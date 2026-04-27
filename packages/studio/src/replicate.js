import { getModelById, getVideoModelById, getI2IModelById, getI2VModelById, getV2VModelById, getLipSyncModelById } from './models.js';

const BASE_URL = 'https://api.replicate.com';

// Maximum file size for data URL conversion (4MB)
const MAX_DATA_URL_FILE_SIZE = 4 * 1024 * 1024;
const MAX_FILE_SIZE_MB = 4;

async function pollForResult(predictionId, key, maxAttempts = 900, interval = 2000) {
    const pollUrl = `${BASE_URL}/v1/predictions/${predictionId}`;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, interval));
        try {
            const response = await fetch(pollUrl, {
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${key}` 
                }
            });
            if (!response.ok) {
                const errText = await response.text();
                if (response.status >= 500) continue;
                throw new Error(`Poll Failed: ${response.status} - ${errText.slice(0, 100)}`);
            }
            const data = await response.json();
            const status = data.status?.toLowerCase();
            if (status === 'succeeded' || status === 'completed' || status === 'success') return data;
            if (status === 'failed' || status === 'canceled' || status === 'cancelled') {
                throw new Error(`Generation failed: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            if (attempt === maxAttempts) throw error;
        }
    }
    throw new Error('Generation timed out after polling.');
}

async function submitAndPoll(modelVersion, input, key, onRequestId, maxAttempts = 60) {
    const url = `${BASE_URL}/v1/predictions`;
    const payload = {
        version: modelVersion,
        input: input
    };
    
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
        // If output is already available
        if (submitData.output) {
            const outputUrl = Array.isArray(submitData.output) ? submitData.output[0] : submitData.output;
            return { ...submitData, url: outputUrl };
        }
        throw new Error('No prediction ID returned');
    }
    
    if (onRequestId) onRequestId(predictionId);
    
    const result = await pollForResult(predictionId, key, maxAttempts);
    const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output;
    return { ...result, url: outputUrl };
}

export async function generateImage(apiKey, params) {
    const modelInfo = getModelById(params.model);
    const modelVersion = modelInfo?.replicateVersion || modelInfo?.endpoint || params.model;
    
    const input = { prompt: params.prompt };
    
    // Map aspect ratio to dimensions
    if (params.aspect_ratio) {
        const [w, h] = params.aspect_ratio.split(':').map(Number);
        if (w && h) {
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
    
    if (params.resolution) input.resolution = params.resolution;
    if (params.quality) input.quality = params.quality;
    
    if (params.image_url) { 
        input.image = params.image_url; 
        input.prompt_strength = params.strength || 0.6; 
    } else if (params.images_list) {
        if (params.images_list.length > 1) {
            input.images = params.images_list;
        } else {
            input.image = params.images_list[0];
        }
    }
    
    if (params.seed && params.seed !== -1) input.seed = params.seed;
    if (params.negative_prompt) input.negative_prompt = params.negative_prompt;
    if (params.guidance_scale) input.guidance_scale = params.guidance_scale;
    if (params.steps) input.num_inference_steps = params.steps;
    
    return submitAndPoll(modelVersion, input, apiKey, params.onRequestId, 60);
}

export async function generateI2I(apiKey, params) {
    const modelInfo = getI2IModelById(params.model);
    const modelVersion = modelInfo?.replicateVersion || modelInfo?.endpoint || params.model;
    
    const input = {};
    if (params.prompt) input.prompt = params.prompt;
    
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
    
    return submitAndPoll(modelVersion, input, apiKey, params.onRequestId, 60);
}

export async function generateVideo(apiKey, params) {
    const modelInfo = getVideoModelById(params.model);
    const modelVersion = modelInfo?.replicateVersion || modelInfo?.endpoint || params.model;
    
    const input = {};
    if (params.prompt) input.prompt = params.prompt;
    if (params.aspect_ratio) input.aspect_ratio = params.aspect_ratio;
    if (params.duration) input.duration = params.duration;
    if (params.resolution) input.resolution = params.resolution;
    if (params.quality) input.quality = params.quality;
    if (params.mode) input.mode = params.mode;
    if (params.image_url) input.image = params.image_url;
    
    return submitAndPoll(modelVersion, input, apiKey, params.onRequestId, 900);
}

export async function generateI2V(apiKey, params) {
    const modelInfo = getI2VModelById(params.model);
    const modelVersion = modelInfo?.replicateVersion || modelInfo?.endpoint || params.model;
    
    const input = {};
    if (params.prompt) input.prompt = params.prompt;
    if (params.image_url) input.image = params.image_url;
    if (params.aspect_ratio) input.aspect_ratio = params.aspect_ratio;
    if (params.duration) input.duration = params.duration;
    if (params.resolution) input.resolution = params.resolution;
    if (params.quality) input.quality = params.quality;
    if (params.mode) input.mode = params.mode;
    
    return submitAndPoll(modelVersion, input, apiKey, params.onRequestId, 900);
}

export async function generateMarketingStudioAd(apiKey, params) {
    // ⚠️ INTENTIONAL PATTERN DEVIATION - DO NOT CHANGE WITHOUT REVIEWING ARCHITECTURE
    // 
    // Marketing Studio uses a different pattern than other generation functions in this codebase.
    // This deviation is intentional and serves Marketing Studio's unique requirements.
    //
    // Reason for deviation:
    // - Marketing ads use various video generation models depending on resolution/quality settings
    // - Rather than hardcoding multiple model mappings in models.js, this allows callers to
    //   dynamically specify the exact Replicate model based on their current requirements
    // - This flexibility is essential for Marketing Studio's multi-resolution ad generation workflow
    //
    // Pattern: Unlike other functions that look up models from models.js, this function expects
    // replicateVersion to be passed directly in the params object.
    //
    // MAINTAINER NOTE: Preserve this pattern unless Marketing Studio's architecture changes
    // to use a fixed set of models that can be statically defined in models.js
    const modelVersion = params.replicateVersion;
    if (!modelVersion) {
        throw new Error(
            'Marketing Studio Ad generation requires a valid Replicate model version. ' +
            'Pass replicateVersion in the params object (e.g., params.replicateVersion = "owner/model:version"). ' +
            'Find models at https://replicate.com/explore'
        );
    }
    
    const input = {
        prompt: params.prompt,
        aspect_ratio: params.aspect_ratio || '16:9',
        duration: params.duration || 5,
    };
    
    if (params.images_list) input.images = params.images_list;
    if (params.video_files) input.videos = params.video_files;
    
    return submitAndPoll(modelVersion, input, apiKey, params.onRequestId, 900);
}

export async function processLipSync(apiKey, params) {
    const modelInfo = getLipSyncModelById(params.model);
    const modelVersion = modelInfo?.replicateVersion || modelInfo?.endpoint || params.model;
    
    const input = {};
    if (params.audio_url) input.audio = params.audio_url;
    if (params.image_url) input.image = params.image_url;
    if (params.video_url) input.video = params.video_url;
    if (params.prompt) input.prompt = params.prompt;
    if (params.resolution) input.resolution = params.resolution;
    if (params.seed !== undefined && params.seed !== -1) input.seed = params.seed;
    
    return submitAndPoll(modelVersion, input, apiKey, params.onRequestId, 900);
}

export function uploadFile(apiKey, file, onProgress) {
    return new Promise((resolve, reject) => {
        // Replicate doesn't have a file upload endpoint
        // Convert to data URL for small files
        if (file.size > MAX_DATA_URL_FILE_SIZE) {
            reject(new Error(
                `File too large for data URL (max ${MAX_FILE_SIZE_MB}MB). ` +
                `Please host files externally using a CDN service (e.g., AWS S3, Cloudinary, ImgBB) ` +
                `and pass the URL instead. See REPLICATE_MIGRATION.md for details.`
            ));
            return;
        }

        const reader = new FileReader();
        
        if (onProgress) {
            reader.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    onProgress(percentComplete);
                }
            };
        }
        
        reader.onload = (e) => {
            resolve(e.target.result);
        };
        
        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };
        
        reader.readAsDataURL(file);
    });
}

export async function getUserBalance(apiKey) {
    // Replicate doesn't have a balance endpoint in the same way
    // You'd need to check your account page or implement a custom solution
    throw new Error('Balance checking not supported with Replicate provider. Check your account at replicate.com/account');
}

export async function getTemplateWorkflows(apiKey) {
    // Workflow features are muapi-specific
    throw new Error('Workflow features not supported with Replicate provider');
}

export async function getUserWorkflows(apiKey) {
    throw new Error('Workflow features not supported with Replicate provider');
}

export async function getPublishedWorkflows(apiKey) {
    throw new Error('Workflow features not supported with Replicate provider');
}

export async function getTemplateAgents(apiKey) {
    throw new Error('Agent features not supported with Replicate provider');
}

export async function getUserAgents(apiKey) {
    throw new Error('Agent features not supported with Replicate provider');
}

export async function getPublishedAgents(apiKey) {
    throw new Error('Agent features not supported with Replicate provider');
}

export async function getUserConversations(apiKey) {
    throw new Error('Conversation features not supported with Replicate provider');
}

export async function getConversation(apiKey, conversationId) {
    throw new Error('Conversation features not supported with Replicate provider');
}

export async function sendMessage(apiKey, conversationId, message, agentId) {
    throw new Error('Conversation features not supported with Replicate provider');
}

export async function createConversation(apiKey, agentId, initialMessage) {
    throw new Error('Conversation features not supported with Replicate provider');
}

export async function deleteConversation(apiKey, conversationId) {
    throw new Error('Conversation features not supported with Replicate provider');
}

export async function createAgent(apiKey, agentData) {
    throw new Error('Agent creation not supported with Replicate provider');
}

export async function updateAgent(apiKey, agentId, agentData) {
    throw new Error('Agent update not supported with Replicate provider');
}

export async function deleteAgent(apiKey, agentId) {
    throw new Error('Agent deletion not supported with Replicate provider');
}

export async function getAgent(apiKey, agentId) {
    throw new Error('Agent features not supported with Replicate provider');
}

export async function publishAgent(apiKey, agentId) {
    throw new Error('Agent publishing not supported with Replicate provider');
}

export async function unpublishAgent(apiKey, agentId) {
    throw new Error('Agent publishing not supported with Replicate provider');
}

export async function createWorkflow(apiKey, payload) {
    throw new Error('Workflow features not supported with Replicate provider');
}

export async function updateWorkflowName(apiKey, workflowId, name) {
    throw new Error('Workflow features not supported with Replicate provider');
}

export async function getWorkflowInputs(apiKey, workflowId) {
    throw new Error('Workflow features not supported with Replicate provider');
}

export async function getAllNodeSchemas(apiKey, workflowId) {
    throw new Error('Workflow features not supported with Replicate provider');
}

export async function getWorkflowData(apiKey, workflowId) {
    throw new Error('Workflow features not supported with Replicate provider');
}

export async function saveWorkflow(apiKey, workflowData) {
    throw new Error('Workflow features not supported with Replicate provider');
}

export async function updateWorkflow(apiKey, workflowId, workflowData) {
    throw new Error('Workflow features not supported with Replicate provider');
}

export async function deleteWorkflow(apiKey, workflowId) {
    throw new Error('Workflow features not supported with Replicate provider');
}

export async function publishWorkflow(apiKey, workflowId) {
    throw new Error('Workflow publishing not supported with Replicate provider');
}

export async function unpublishWorkflow(apiKey, workflowId) {
    throw new Error('Workflow publishing not supported with Replicate provider');
}

export async function executeWorkflow(apiKey, workflowId, inputs) {
    throw new Error('Workflow execution not supported with Replicate provider');
}

export async function getWorkflowRuns(apiKey, workflowId) {
    throw new Error('Workflow features not supported with Replicate provider');
}

export async function getWorkflowRunResult(apiKey, runId) {
    throw new Error('Workflow features not supported with Replicate provider');
}
