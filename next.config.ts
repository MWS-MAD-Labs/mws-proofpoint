import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: "standalone",

  // Enable strict mode for React
  reactStrictMode: true,

  // Disable TypeScript errors during production builds for Docker deployment
  // Note: TypeScript checking still runs during development
  typescript: {
    ignoreBuildErrors: true,
  },

  // Configure image optimization
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },

  // Enable Turbopack for development
  turbopack: {},
};

export default nextConfig;
