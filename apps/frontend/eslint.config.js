import antfu from '@antfu/eslint-config'

export default antfu({
  svelte: true,
  formatters: true,
  ignores: ['.svelte-kit', 'dist'],
  rules: {
    'test/no-import-node-test': 'off',
  },
})
