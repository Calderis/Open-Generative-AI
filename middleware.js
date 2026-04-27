import { NextResponse } from 'next/server';

export function middleware(request) {
    const url = request.nextUrl;
    
    // Catch requests to /api/workflow, /api/app, and /api/v1
    const isApiProxy = url.pathname.startsWith('/api/workflow') || 
                      url.pathname.startsWith('/api/app') || 
                      url.pathname.startsWith('/api/v1');

    if (isApiProxy) {
        // Remap /api/v1 ONLY if it's not handled by a specific route.
        // Note: Replicate API uses api.replicate.com, not api.muapi.ai
        if (url.pathname.startsWith('/api/v1')) {
            const targetUrl = new URL(url.pathname + url.search, 'https://api.replicate.com');
            return NextResponse.rewrite(targetUrl);
        }
    }

    return NextResponse.next();
}

// Match the paths we want to proxy
export const config = {
    matcher: [
        '/api/workflow/:path*', 
        '/api/app/:path*',
        '/api/v1/:path*'
    ],
};
