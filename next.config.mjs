/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['googleapis', 'tesseract.js', 'jimp', 'exceljs'],
  },
};

export default nextConfig;
