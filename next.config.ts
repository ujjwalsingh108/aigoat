import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* other config options */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "kowxpazskkigzwdwzwyq.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  devIndicators: false,
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "truedata-nodejs"];
    }
    return config;
  },
  experimental: {
    proxy: "./src/proxy.ts",
  },
};

export default nextConfig;
