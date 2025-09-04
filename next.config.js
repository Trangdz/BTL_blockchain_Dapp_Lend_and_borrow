/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: false, // Disable to prevent double mounting issues
  images: {
    unoptimized: true, // Disable image optimization for development
  },
  webpack: (config) => {
    config.resolve.fallback = {
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
}
