// Enforces the one architectural rule that matters most for this project:
// src/core/** must never import React, state, ui, or features — it's the
// engine, and it stays pure (data in, data out) so it's usable and testable
// without a browser or a component tree.
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import boundaries from 'eslint-plugin-boundaries';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
      globals: {
        DOMParser: 'readonly',
        Document: 'readonly',
        Element: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        alert: 'readonly',
        Blob: 'readonly',
        FileReader: 'readonly',
        Response: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLSelectElement: 'readonly',
        HTMLObjectElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLElement: 'readonly',
        HTMLButtonElement: 'readonly',
        KeyboardEvent: 'readonly',
        Event: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      boundaries,
    },
    settings: {
      'boundaries/elements': [
        { type: 'core', pattern: 'src/core/*' },
        { type: 'state', pattern: 'src/state/*' },
        { type: 'features', pattern: 'src/features/*' },
        { type: 'ui', pattern: 'src/ui/*' },
        { type: 'theme', pattern: 'src/theme/*' },
        { type: 'types', pattern: 'src/types/*' },
      ],
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          rules: [
            {
              from: 'core',
              disallow: ['state', 'features', 'ui', 'theme'],
              message: 'core/ is the engine and must not depend on React, state, or UI — keep it pure.',
            },
          ],
        },
      ],
    },
  },
];
