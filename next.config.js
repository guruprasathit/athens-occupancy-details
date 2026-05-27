/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Prevent webpack from bundling pdfmake — it must run as native CJS in Node.js
  experimental: {
    serverComponentsExternalPackages: ['pdfmake'],
  },
}
module.exports = nextConfig
