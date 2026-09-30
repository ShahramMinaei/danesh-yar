import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Static hosting build (GitHub Pages): STATIC_EXPORT=1 emits plain HTML/CSS/JS to
 * `out/`, served under PAGES_BASE_PATH (e.g. "/danesh-yar"). Static hosts can't send
 * response headers, and `headers()` is unsupported with `output: "export"`, so the
 * security headers below apply only when the app runs on a Next.js server.
 */
const staticExport = process.env.STATIC_EXPORT === "1";
const basePath = staticExport ? process.env.PAGES_BASE_PATH || "" : "";

/**
 * Content-Security-Policy without nonces (the page is statically rendered).
 * Only same-origin scripts/styles/fonts load; images also allow blob: (attachment
 * previews) and data:. No plugins, no framing (clickjacking), no foreign form
 * targets. Dev adds 'unsafe-eval' (React's debug stacks) and ws: (HMR).
 * upgrade-insecure-requests is production-only: it would break http://localhost.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // the composer's voice input needs the microphone; nothing else is used
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  ...(staticExport
    ? { output: "export" as const, basePath, trailingSlash: true }
    : {
        async headers() {
          return [{ source: "/(.*)", headers: securityHeaders }];
        },
      }),
};

export default nextConfig;
