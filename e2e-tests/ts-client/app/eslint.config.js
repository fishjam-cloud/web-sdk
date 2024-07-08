import parser from "@typescript-eslint/eslint-plugin";
import reactRefresh from "eslint-plugin-react-refresh";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

// export default (
//
// );

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "@typescript-eslint": parser,
      "react-refresh": reactRefresh,
    },
    // extends: [
    //   "eslint:recommended",
    //   "plugin:@typescript-eslint/eslint-recommended",
    //   "plugin:@typescript-eslint/recommended",
    //   "prettier",
    // ],
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  eslintPluginPrettierRecommended
);
