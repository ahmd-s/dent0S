const nextConfig = {
  output: 'standalone',
  // Uploads are served through Cloudinary's CDN, which already handles format
  // negotiation and resizing, so routing them through the Next optimizer would
  // add a hop without a benefit. See components/ui/async-image.jsx.
  images: {
    unoptimized: true,
  },
  // Stack traces in production responses are a disclosure risk; the source maps
  // stay available in the build output for error reporting.
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  compress: true,
  experimental: {
    serverComponentsExternalPackages: ['mongodb'],
    // lucide-react is imported in 160+ files. Without this, a barrel import
    // pulls the whole icon module graph into each chunk and slows compilation.
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  webpack(config, { dev }) {
    if (dev) {
      config.watchOptions = {
        poll: 2000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules'],
      };
    }
    return config;
  },
  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },
  async headers() {
    const isProd = process.env.NODE_ENV === 'production'
    const corsOrigin = process.env.CORS_ORIGINS || (isProd ? 'https://app.dent-os.in' : '*')

    const secureHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
      { key: 'Access-Control-Allow-Origin', value: corsOrigin },
      { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS, PATCH' },
      { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-CSRF-Token, X-Correlation-Id' },
    ]

    return [
      {
        source: '/lab-portal/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: 'frame-ancestors *;' },
        ],
      },
      {
        source: '/book/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: 'frame-ancestors *;' },
        ],
      },
      {
        source: '/(.*)',
        headers: secureHeaders,
      },
      // Hashed build assets are immutable; without this they revalidate on
      // every navigation.
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // Authenticated JSON must never be stored by a shared cache.
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
    ];
  },
};

module.exports = nextConfig;
