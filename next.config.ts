import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },   // ✅ skip ESLint in CI
  // keep TS errors failing the build; flip to true only if you really must ship
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
