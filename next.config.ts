import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // public/prototypes/ の試作は静的な HTML。ディレクトリへのアクセスを一覧ページに向ける。
  rewrites() {
    return [{ source: "/prototypes", destination: "/prototypes/index.html" }];
  },
};

export default nextConfig;
