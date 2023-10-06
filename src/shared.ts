import { type Node } from 'estree'
import esprima from 'esprima'
import { generate } from 'escodegen'
import md5 from 'md5'
import { createClient } from 'redis'
import ESTraverse from 'estraverse'

export const db = createClient()

await db.connect()

export function parse (code: string): Node {
  // ? parseScript or parseModule
  return esprima.parseModule(code, {
    tolerant: true
  })
}

export function getName (node: Node): string | undefined {
  if ('name' in node) return node.name
}

export function getNames (ast: Node): Set<string> {
  const names = new Set<string>()

  ESTraverse.traverse(ast, {
    enter (node) {
      const name = getName(node)

      if (name === undefined) return

      names.add(name)
    }
  })

  return names
}

export function createMapping (from: Set<string>, to: Set<string>): Map<string, string> {
  const map = new Map<string, string>()

  const fromValues = from.values()
  const toValues = to.values()

  for (let i = 0; true; i++) {
    const fromResult = fromValues.next()
    const toResult = toValues.next()

    // ? && or ||?
    if (
      (fromResult.done !== undefined && fromResult.done) ||
      (toResult.done !== undefined && toResult.done)
    ) break

    map.set(
      fromResult.value,
      toResult.value
    )
  }

  return map
}

export function createNormalizedMap (ast: Node): Map<string, string> {
  const map = new Map<string, string>()

  ESTraverse.traverse(ast, {
    enter (node) {
      const name = getName(node)

      if (name === undefined) return

      if (!map.has(name)) {
        map.set(name, `_${map.size}`)
      }
    }
  })

  return map
}

export function applyMapping (ast: Node, map: Map<string, string>): Node {
  ESTraverse.traverse(ast, {
    enter (node) {
      if (!('name' in node)) return

      const name = node.name

      if (name === undefined) return

      const newName = map.get(name)

      if (newName === undefined) return

      node.name = newName
    }
  })

  return ast
}

export function normalizeAst (ast: Node): void {
  const map = createNormalizedMap(ast)

  applyMapping(ast, map)
}

export const HASH_KEY_BLACKLIST = new Set([
  'start', 'end',
  'raw'
])

// export function stringifyAST (ast: Node): string {
//   return JSON.stringify(ast, (key, value) => {
//     if (HASH_KEY_BLACKLIST.has(key)) return undefined

//     return value
//   })
// }

export function hashCode (data: string | Node): string {
  const ast = typeof data === 'string' ? parse(data) : structuredClone(data)
  normalizeAst(ast)

  const code = generate(ast)
  const hash = md5(code)

  return hash
}
