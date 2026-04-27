# Replicate Migration Guide

This document explains the migration from Muapi to Replicate as the AI model provider for Open Generative AI.

## What Changed

### API Provider
- **Before**: Muapi.ai (`https://api.muapi.ai`)
- **After**: Replicate.com (`https://api.replicate.com`)

### Authentication
- **Before**: `x-api-key` header
- **After**: `Authorization: Bearer {token}` header

### API Key Storage
- **Before**: `localStorage.getItem('muapi_key')`
- **After**: `localStorage.getItem('replicate_key')`

### File Structure
New files created:
- `/src/lib/replicate.js` - Main Replicate client (class-based)
- `/packages/studio/src/replicate.js` - Studio package Replicate client (functional)

## Key Differences

### 1. API Endpoints
**Muapi**:
```javascript
POST /api/v1/{model-endpoint}
GET /api/v1/predictions/{request_id}/result
```

**Replicate**:
```javascript
POST /v1/predictions
GET /v1/predictions/{prediction_id}
```

### 2. Model Identification
**Muapi**: Uses custom endpoint names (e.g., `"flux-dev-image"`)

**Replicate**: Uses model versions (e.g., `"black-forest-labs/flux-dev:latest"`)

### 3. File Uploads
**Muapi**: Had a dedicated upload endpoint

**Replicate**: Files must be:
- Converted to data URLs (for files < 4MB), or
- Hosted externally (S3, CDN) and passed as URLs

### 4. Request Format
**Muapi**:
```javascript
{
  "prompt": "a cat",
  "aspect_ratio": "1:1",
  "seed": 42
}
```

**Replicate**:
```javascript
{
  "version": "model-version-string",
  "input": {
    "prompt": "a cat",
    "width": 1024,
    "height": 1024,
    "seed": 42
  }
}
```

## Migration Steps Completed

✅ Created Replicate API clients
✅ Updated all component imports
✅ Updated API key storage and references
✅ Updated UI components (AuthModal, SettingsModal, ApiKeyModal)
✅ Updated documentation (README, project_knowledge.md)
✅ Updated configuration (vite.config.mjs, middleware.js)

## What Needs To Be Done

### 🔴 Critical: Model Configuration

The models in `packages/studio/src/models.js` need to be updated with Replicate model versions.

**Current state**:
```javascript
{
  "id": "flux-dev",
  "name": "Flux Dev",
  "endpoint": "flux-dev-image",
  "inputs": { ... }
}
```

**Required state**:
```javascript
{
  "id": "flux-dev",
  "name": "Flux Dev",
  "endpoint": "flux-dev-image",  // Legacy, can be removed
  "replicateVersion": "black-forest-labs/flux-dev:latest",
  "inputs": { ... }
}
```

### How to Find Replicate Model Versions

1. Visit https://replicate.com/explore
2. Search for the model (e.g., "Flux Dev")
3. Click on the model
4. The version string is shown on the model page
5. Format: `"{owner}/{model-name}:{version}"`

Example models to update:
- Flux Dev → `black-forest-labs/flux-dev:latest`
- SDXL → `stability-ai/sdxl:latest`
- Kling → Find equivalent on Replicate

### Features Not Supported on Replicate

The following Muapi-specific features throw errors with helpful messages:
- Workflow management (`getTemplateWorkflows`, `saveWorkflow`, etc.)
- Agent management (`getTemplateAgents`, `createAgent`, etc.)
- Balance checking (`getUserBalance`)

These features are Muapi-specific and would require a different implementation or custom backend.

## Testing Checklist

- [ ] Test image generation (T2I)
- [ ] Test image-to-image generation
- [ ] Test video generation (T2V)
- [ ] Test image-to-video generation
- [ ] Test lip sync functionality
- [ ] Test file upload (data URLs)
- [ ] Test API key management
- [ ] Verify error handling
- [ ] Test on desktop app
- [ ] Test on web app

## Rollback Plan

If you need to rollback to Muapi:
1. Restore `muapi_key` localStorage key
2. Update imports from `./replicate.js` back to `./muapi.js`
3. Revert API proxy settings in middleware.js and vite.config.mjs
4. The original `muapi.js` files are still in the repository

## Notes

- The hosted version at dev.muapi.ai will continue to use Muapi for the foreseeable future
- Self-hosted version now uses Replicate by default
- Both providers can coexist if needed (keep both client files)
- Consider adding provider selection in settings for flexibility
- This migration allows self-hosted users to use Replicate's infrastructure while maintaining compatibility
