/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["pdfkit", "exceljs", "bcryptjs"],
  // pdfkit reads its font metrics from disk at runtime; make sure standalone output ships them.
  outputFileTracingIncludes: { "/api/v1/offerings/[id]/results/[action]": ["./node_modules/pdfkit/js/data/**/*"] },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
