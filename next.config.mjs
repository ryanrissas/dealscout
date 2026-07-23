/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
  experimental: { serverComponentsExternalPackages: ["bcryptjs", "@prisma/client", "@prisma/adapter-pg", "pg", "nodemailer"] }
};
export default nextConfig;
