import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-only packages that must not be bundled by webpack.
  serverExternalPackages: ["@react-pdf/renderer", "bcryptjs"],
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
