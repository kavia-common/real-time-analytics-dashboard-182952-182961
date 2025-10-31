/** @type {import("eslint").FlatConfig[]} */
const jsConfig = {
  files: ['**/*.js'],
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'commonjs',
  },
  rules: {
    semi: ['error', 'always'],
    quotes: ['error', 'single'],
  },
};

const ignoreConfig = {
  ignores: ['node_modules/**', '../react_frontend/**', 'real-time-analytics-dashboard-182952-182962/**'],
};

module.exports = [ignoreConfig, jsConfig];