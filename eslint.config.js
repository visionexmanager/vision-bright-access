import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist", "dist-ssr", "node_modules", ".claude", "supabase/.temp",
      // Generated shadcn/ui components — not our code to lint
      "src/components/ui/**",
      // Separate sub-projects with their own CI
      "visionex-tv/**",
      "infra/**",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars":                   "off",
      "@typescript-eslint/no-explicit-any":                  "warn",
      "@typescript-eslint/no-empty-object-type":             "warn",
      "@typescript-eslint/ban-ts-comment":                   "warn",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "warn",
      "@typescript-eslint/no-unused-expressions":            "warn",
      "no-empty":          ["warn", { allowEmptyCatch: true }],
      "no-useless-escape": "warn",
      "prefer-const":      "warn",
    },
  },
);
