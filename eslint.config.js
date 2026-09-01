import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

// ponytail: rekommenderade regler utan typinformation, det räcker för att fånga
// oanvända variabler och trasiga importer. Typkontrollen gör tsc redan.
export default tseslint.config(
  { ignores: ['dist', 'server/dist', 'server/worker-configuration.d.ts', 'graft', 'node_modules', 'dev-dist'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }]
    }
  }
)
