// @ts-check
import { baseConfig } from "@lotus-desk/config/eslint/base.js";

export default [
  ...baseConfig,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
  },
];
