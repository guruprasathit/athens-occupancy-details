/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Prevent webpack from bundling pdfmake for server-side code (API routes).
  // experimental.serverComponentsExternalPackages only covers App Router;
  // the webpack externals function covers Pages Router API routes too.
  experimental: {
    serverComponentsExternalPackages: ['pdfmake'],
  },
  webpack(config, { isServer }) {
    if (isServer) {
      const prev = Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean);
      config.externals = [
        ...prev,
        ({ request }, callback) => {
          if (request === 'pdfmake' || request.startsWith('pdfmake/')) {
            return callback(null, 'commonjs ' + request);
          }
          callback();
        },
      ];
    }
    return config;
  },
}
module.exports = nextConfig
