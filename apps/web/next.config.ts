import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@ledgr/supabase', '@ledgr/banking', '@ledgr/tax-engine', '@ledgr/invoicing'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};

export default nextConfig;
