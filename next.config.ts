import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // public/prototypes/ の試作は静的な HTML。一覧ページの相対リンク（ik-1.html など）が
  // /prototypes/ 配下に解決されるよう、rewrite ではなく redirect で URL ごと移す。
  redirects() {
    return [{ source: "/prototypes", destination: "/prototypes/index.html", permanent: false }];
  },
};

export default nextConfig;
