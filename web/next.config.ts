import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 允许服务端代码读到仓库根的 projects/ 与 src/(只读 JSON / 调 CLI)
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
