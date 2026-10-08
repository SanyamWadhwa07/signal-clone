import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: lets a second browser origin (127.0.0.1) sign in as another user next to localhost,
  // since each origin has its own localStorage. No effect on production builds.
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false, // the dev badge sits on top of the profile avatar in the nav rail
  async headers() {
    // Production only: X-Frame-Options would block the iframe-based responsive checks used in dev.
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
