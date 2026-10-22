import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config({ ignores: ['**/node_modules/**', '**/.expo/**', '**/dist/**'] }, js.configs.recommended, { files: ['**/*.mjs'], languageOptions: { globals: { fetch: 'readonly', setTimeout: 'readonly', console: 'readonly' } } }, ...ts.configs.recommended, { files: ['**/*.{ts,tsx}'], rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } });
