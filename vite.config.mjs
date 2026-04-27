import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    server: {
        // Replicate API doesn't need a proxy - requests go directly to api.replicate.com
        // For local development with CORS restrictions, uncomment the proxy below:
        // proxy: {
        //     '/api': {
        //         target: 'https://api.replicate.com',
        //         changeOrigin: true,
        //         secure: false
        //     }
        // }
    }
});
