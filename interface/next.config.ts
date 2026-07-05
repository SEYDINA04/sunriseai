import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Content-Security-Policy: defense-in-depth for the untrusted model output we render.
// - media/blob/data: Web Audio conversion + inline <audio> previews
// - img react-circle-flags loads SVGs from its default CDN
// - connect 'self': the browser only talks to our own /api proxy (the ASR backend
//   call happens server-side and is not subject to this policy)
// NOTE: script-src uses 'unsafe-inline' because Next injects inline bootstrap
// scripts; a nonce-based policy (via middleware) is the future hardening step.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: https://react-circle-flags.pages.dev",
  "media-src 'self' blob: data:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
  // noindex on every response (also covers non-HTML assets a <meta> tag cannot).
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
