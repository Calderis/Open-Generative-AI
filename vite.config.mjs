import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    server: {
        // Replicate API doesn't need a proxy - requests go directly to api.replicate.com
        // Uncomment below if you need to proxy API requests during development
        // proxy: {
        //     '/api': {
        //         target: 'https://api.replicate.com',
        //         changeOrigin: true,
        //         secure: false
        //     }
        // }
    }
});
