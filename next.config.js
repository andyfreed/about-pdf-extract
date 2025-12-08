/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable serverless functions for Vercel
  experimental: {
    serverActions: true,
  },
}

module.exports = nextConfig
