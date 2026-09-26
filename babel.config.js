module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Drizzle のマイグレーション（.sql）をバンドルに文字列として埋め込む
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
