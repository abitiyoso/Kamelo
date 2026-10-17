import type { NextConfig } from "next";
const config: NextConfig = {
  output: process.platform === "win32" ? undefined : "standalone",
  poweredByHeader: false,
  images: { qualities: [75, 85] },
};
export default config;
