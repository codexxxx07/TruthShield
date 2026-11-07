import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react },
    settings: { react: { version: 'detect' } },
    rules: {
      // Without this, every component used only in JSX is reported as unused.
      'react/jsx-uses-vars': 'error',
      // These modules intentionally co-locate their provider/helpers with the
      // component (contexts, icon registry, severity labels). Fast Refresh
      // reloads them fully instead of hot-patching, which is acceptable here.
      'react-refresh/only-export-components': [
        'error',
        {
          allowExportNames: [
            'useAuth',
            'useTheme',
            'useToast',
            'iconFor',
            'toneForScore',
            'SEVERITY_LABEL',
          ],
        },
      ],
    },
  },
])
