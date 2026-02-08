/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Optional: proxy API to backend in dev (or use NEXT_PUBLIC_API_URL)
  // async rewrites() {
  //   return [{ source: '/api/proxy/:path*', destination: 'http://localhost:8000/:path*' }];
  // },
};

module.exports = nextConfig;
