/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  typescript: {
    ignoreBuildErrors: true,
  },

  // When API_URL is set (e.g. on Vercel), proxy /api/v1/* to the backend so the client
  // can use same-origin requests and avoid CORS / build-time env issues.
  async rewrites() {
    const apiUrl = process.env.API_URL?.trim();
    if (!apiUrl) return [];
    const base = apiUrl.replace(/\/$/, '');
    return [
      {
        source: '/api/v1/:path*',
        destination: `${base}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
