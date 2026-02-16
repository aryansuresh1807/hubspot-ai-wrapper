/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  typescript: {
    ignoreBuildErrors: true,
  },

  // Proxy API requests to the backend (Railway). Uses API_URL or NEXT_PUBLIC_API_URL
  // so rewrites work on Vercel build (either var is available at build time).
  // Client uses same-origin /api/v1/* so no CORS; Next.js rewrites to backend.
  async rewrites() {
    const raw = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').trim();
    if (!raw) {
      if (process.env.VERCEL === '1') {
        console.warn(
          '\n⚠️  API proxy rewrites are DISABLED: API_URL and NEXT_PUBLIC_API_URL are both missing at build time.\n' +
            '   Set at least one in Vercel → Settings → Environment Variables for this environment (Production and Preview).\n' +
            '   Then redeploy. See DEPLOYMENT.md.\n'
        );
      }
      return [];
    }
    const firstUrl = raw.split(/\s+/)[0]?.trim();
    if (!firstUrl) return [];
    const base = firstUrl.replace(/\/$/, '');
    try {
      new URL(base);
    } catch {
      return [];
    }
    return [
      {
        source: '/api/v1/:path*',
        destination: `${base}/api/v1/:path*`,
      },
      // So frontend can ping backend health via same origin (e.g. fetch('/backend-health'))
      { source: '/backend-health', destination: `${base}/health` },
    ];
  },
};

module.exports = nextConfig;
