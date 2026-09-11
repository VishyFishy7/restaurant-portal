import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep better-sqlite3 as a native server dependency (not bundled by Turbopack).
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;