import type { NextConfig } from "next";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require('./package.json') as { version?: string };

const nextConfig: NextConfig = {
  // distDir is env-driven so a production build can be written to a staging
  // folder (NEXT_BUILD_DIR=.next-build) and atomically swapped in, never
  // corrupting the live .next. At runtime the var is unset, so it stays '.next'.
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ["pg", "bcryptjs"],

  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version ?? '1.0.0',
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*' },
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
