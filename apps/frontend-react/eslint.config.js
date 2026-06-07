import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  ignores: ['src/routeTree.gen.ts'],
  rules: {
    'test/no-import-node-test': 'off',
  },
})
