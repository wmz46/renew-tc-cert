module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
    node: true, // 添加 node 环境
  },
  extends: ["eslint:recommended",
   "plugin:@typescript-eslint/recommended", ],
  plugins: ["@typescript-eslint"],
  overrides: [
    {
      files: ["**/*.ts", "**/*.tsx"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        project: "./tsconfig.json",
      },
    },
    {
      env: {
        node: true,
      },
      files: [
        ".eslintrc.{js,cjs}",
      ],
      parserOptions: {
        sourceType: "script",
      },
    },
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    "sourceType": "module",

  },
  rules: {
    semi: [2, "never"],
    quotes: [1, "double"],
    "no-multi-spaces": "error",
    "space-infix-ops": ["error", { int32Hint: false }],
    "no-whitespace-before-property": "error",
    "import/no-extraneous-dependencies": [0, {
      devDependencies: true,
      peerDependencies: true,
    }],
    "linebreak-style": [0],
    "import/no-dynamic-require": [0],
    "global-require": [0],
    "@typescript-eslint/no-explicit-any": ["off"]
  },

}
