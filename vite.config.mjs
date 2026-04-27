import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    server: {
        // Replicate API supports CORS from browser origins by default
        // This proxy is for the Vite development server only
        // For production, see middleware.js (Next.js middleware) which handles API proxying
        // 
        // The proxy below is optional for local development and only needed if you encounter
        // CORS issues or want to route requests through logging/debugging tools
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
