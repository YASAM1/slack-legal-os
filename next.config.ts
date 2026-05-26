import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['sharp', 'vega', 'vega-lite'],
};

export default nextConfig;
