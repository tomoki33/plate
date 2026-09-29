import type { NextConfig } from 'next';
import path from 'node:path';

const config: NextConfig = {
  // アプリ（../src）と同じ集計・目標プランのロジックを、そのまま使う
  experimental: { externalDir: true },
  outputFileTracingRoot: path.join(__dirname, '..'),
};
export default config;
