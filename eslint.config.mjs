import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  {
    rules: {
      "@typescript-eslint/no-explicit-any":             "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern:          "^_",
          varsIgnorePattern:          "^_",
          caughtErrorsIgnorePattern:  "^_",
        },
      ],
      "@typescript-eslint/no-non-null-assertion":       "warn",
      "@typescript-eslint/consistent-type-imports":     ["warn", { prefer: "type-imports" }],
      "@typescript-eslint/no-import-type-side-effects": "error",
      "no-console":           ["warn", { allow: ["warn", "error", "log"] }],
      "no-debugger":          "error",
      "no-duplicate-imports": "error",
      "prefer-const":         "error",
      "no-var":               "error",
      "eqeqeq":               ["error", "always", { null: "ignore" }],
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "warn",
      "import/no-duplicates":        "error",
    },
  },

  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "dist/**",
      "prisma/migrations/**",
      "*.config.js",
      "*.config.mjs",
      "*.config.ts",
    ],
  },
];

export default eslintConfig;
