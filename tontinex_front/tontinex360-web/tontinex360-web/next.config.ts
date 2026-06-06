import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Backend en dev local
      { protocol: 'http', hostname: 'localhost', port: '8000' },
      { protocol: 'http', hostname: 'localhost', port: '8010' },
      // Backend en production (Render)
      { protocol: 'https', hostname: 'tontine-project.onrender.com' },
    ],
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: process.env.NEXT_PUBLIC_API_URL + '/:path*' },
    ];
  },
};

export default nextConfig;
