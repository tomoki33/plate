// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "drizzle/*", "supabase/functions/*", "coach/**"],
    rules: {
      // シートを開いたときに props から state を合わせる書き方を、意図して使っている
      "react-hooks/set-state-in-effect": "warn",
    },
  }
]);
