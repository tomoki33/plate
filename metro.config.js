const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Drizzle のマイグレーション（.sql）と、Web での expo-sqlite（wasm）
config.resolver.sourceExts.push('sql');
config.resolver.assetExts.push('wasm');

// Web の expo-sqlite は SharedArrayBuffer が要るため、開発サーバーにも COOP/COEP ヘッダーを付ける
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  return middleware(req, res, next);
};

module.exports = config;
