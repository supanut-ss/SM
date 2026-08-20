// @ts-check
import { baseConfig } from "@lotus-desk/config/eslint/base.js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  ...baseConfig,
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    plugins: { react, "react-hooks": reactHooks },
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
    },
    settings: {
      react: { version: "19" },
    },
  },
];
