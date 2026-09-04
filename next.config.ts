import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  // Firebase Frameworks 패키저가 firebase-admin을 해시 외부 모듈로
  // 치환하지 않도록 서버 번들에 함께 포함한다.
  transpilePackages: ['firebase-admin'],
  /* config options here */
};

export default nextConfig;
