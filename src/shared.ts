import * as acorn from 'acorn'
import * as walk from 'acorn-walk'
import md5 from 'md5'
import { createClient } from 'redis'

export const db = createClient()

await db.connect()

export function parse (code: string): acorn.Node {
  return acorn.parse(code, {
    ecmaVersion: 'latest',

    allowReserved: true,
    allowReturnOutsideFunction: true,
    allowImportExportEverywhere: true,
    allowAwaitOutsideFunction: true,
    allowSuperOutsideMethod: true
  })
}

export function createNormalizedAST (ast: acorn.Node): acorn.Node {
  const identifierMap = new Map<string, string>()

  walk.full(ast, node => {
    let name: string | undefined

    switch (node.type) {
      case 'Identifier':
        name = (node as any).name
        break
      case 'Literal':
        name = (node as any).value
        break
    }

    if (name === undefined) return

    if (!identifierMap.has(name)) {
      identifierMap.set(name, `_${identifierMap.size}`)
    }

    (node as any).name = identifierMap.get(name)
  })

  return ast
}

export const HASH_KEY_BLACKLIST = new Set([
  'start', 'end',
  'raw'
])

export function stringifyAST (ast: acorn.Node): string {
  return JSON.stringify(ast, (key, value) => {
    if (HASH_KEY_BLACKLIST.has(key)) return undefined

    return value
  })
}

export function hashCode (code: string): string {
  const ast = parse(code)
  const normalized = createNormalizedAST(ast)
  const string = stringifyAST(normalized)
  const hash = md5(string)

  return hash
}
