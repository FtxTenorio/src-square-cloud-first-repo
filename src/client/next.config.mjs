import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  productionBrowserSourceMaps: false,
  experimental: {
    webpackMemoryOptimizations: true,
    cpus: 1,
  },
};

export default nextConfig;
