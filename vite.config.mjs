import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    server: {
        // Replicate API supports CORS from browser origins by default
        // The proxy below is optional and only needed if you encounter CORS issues in development
        // or want to route requests through the Next.js middleware for logging/debugging
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
