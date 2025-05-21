// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/api/auth/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' https://accounts.google.com",
              "style-src  'self' 'unsafe-inline'",
              // <-- add https://authjs.dev here:
              "img-src    'self' data: https://authjs.dev",
              "connect-src 'self' https://accounts.google.com",
              "font-src   'self'",
              "frame-src  https://accounts.google.com",
              "object-src 'none'",
            ].join("; ")
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          }
        ]
      }
    ];
  },
  // Add other Next.js config options here if needed
};

export default nextConfig;
