import type { NextConfig } from "next";

/**
 * Public path: goldengoosetools.com/tools/domain-ssl-report
 * Shop reverse-proxies this app under the same path.
 */
const nextConfig: NextConfig = {
  basePath: "/tools/domain-ssl-report",
  reactStrictMode: true,
  transpilePackages: ["ggt-design-kit"],
};

export default nextConfig;
