import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

// Deliberate correctness baseline, not a style migration or type-aware security audit.
export default [
  { ignores: ['dist/**', 'node_modules/**', '.angular/**', 'coverage/**', 'test-results/**', 'playwright-report/**'] },
  {
    files: ['src/**/*.ts', 'e2e/**/*.ts', 'playwright.config.ts'],
    languageOptions: { parser: tseslint.parser },
    plugins: { '@typescript-eslint': tseslint.plugin },
    processor: angular.processInlineTemplates,
    rules: {
      'no-constant-condition': 'error',
      'no-dupe-args': 'error',
      'no-dupe-keys': 'error',
      'no-sparse-arrays': 'error',
      'no-unreachable': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error'
    }
  },
  {
    files: ['src/**/*.html'],
    languageOptions: { parser: angular.templateParser },
    plugins: { '@angular-eslint/template': angular.templatePlugin },
    rules: {
      '@angular-eslint/template/banana-in-box': 'error',
      '@angular-eslint/template/eqeqeq': ['error', { allowNullOrUndefined: true }],
      '@angular-eslint/template/no-negated-async': 'error'
    }
  }
];
