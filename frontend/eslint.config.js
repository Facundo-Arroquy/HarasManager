import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Permitir prefijo `_` para parámetros/variables intencionalmente sin usar
      // (firmas de interfaz, callbacks de RPC, etc.)
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      // Los effects de carga de datos setean un flag de "loading" de forma
      // síncrona antes del fetch async; es un patrón intencional en todo el
      // código. Esta regla (nueva en react-hooks v6) lo marcaría como error.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
