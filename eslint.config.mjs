import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config(
  { ignores: ['**/node_modules/**', '**/.expo/**', '**/dist/**'] },
  js.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        fetch: 'readonly',
        setTimeout: 'readonly',
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
  ...ts.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
  {
    files: ['packages/domain/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?:@flowsaldo/domain|(?:\\.{1,2}/)+index(?:\\.[cm]?[jt]s)?)$',
              message: 'En el dominio, importa directamente desde el módulo que define el símbolo.',
            },
          ],
        },
      ],
    },
  },
);
