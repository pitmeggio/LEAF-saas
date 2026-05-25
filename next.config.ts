import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // /dashboard/members was renamed to /dashboard/athletes for naming
      // consistency with the schema + sidebar entry. Keeps every bookmark,
      // notification email link and external reference working.
      { source: "/dashboard/members", destination: "/dashboard/athletes", permanent: true },
      { source: "/dashboard/members/:path*", destination: "/dashboard/athletes/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
