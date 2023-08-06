import * as Terser from 'terser'

export const BLACKLIST = new Set([
  'Identifier',
  'VariableDeclarator',
  'VariableDeclaration'
])

export async function minify (code: string): Promise<Terser.MinifyOutput> {
  return await Terser.minify(code, {
    parse: {
      bare_returns: true
    },
    compress: {
      unsafe: true
    }
  })
}
