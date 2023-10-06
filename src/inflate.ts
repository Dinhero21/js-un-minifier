import fs from 'fs'
import { applyMapping, createMapping, db, getLocalNames, getNames, hashCode, parse } from './shared.js'
import { generate } from 'escodegen'
import { type Node } from 'estree'
import ESTraverse from 'estraverse'

const NODE_TYPE_BLACKLIST = new Set([
  'Identifier',
  'Literal',
  'ThisExpression'
])

const INPUT_FILE = 'inflate/in.js'
const OUTPUT_FILE = 'inflate/out.js'

console.info('Reading input...')

const input = await fs.promises.readFile(INPUT_FILE, 'utf8')

console.info('Parsing ast...')

const ast = parse(input)

console.info('Inflating...')

await inflate(ast)

console.info('Generating output...')

const output = generate(ast)

console.info('Writing output...')

await fs.promises.writeFile(OUTPUT_FILE, output)

console.info('Done!')

async function inflate (ast: Node): Promise<void> {
  const mappings = await inflateScope(ast)

  const mapping = new Map<string, string>()

  for (const [from, tos] of mappings) {
    mapping.set(from, `/*GLOBAL:${Array.from(tos.values()).join(',')}*/${from}`)
  }

  applyMapping(ast, mapping)
}

async function inflateScope (ast: Node): Promise<Map<string, Set<string>>> {
  const hash = hashCode(ast)

  const rawNames = await db.get(hash)

  if (rawNames === null) {
    const mappings = await inflateNode(ast)

    const mapping = new Map<string, string>()

    for (const [from, tos] of mappings) {
      mapping.set(from, `/*${Array.from(tos.values()).join(',')}*/${from}`)
    }

    applyMapping(ast, mapping)

    return mappings
  }

  const nameArray = JSON.parse(rawNames)

  if (!Array.isArray(nameArray)) throw new TypeError('Expected array')

  const to = new Set(nameArray)

  const from = getNames(ast)

  const mapping = createMapping(from, to)

  const outOfScopeMapping = new Map<string, Set<string>>()

  for (const [from, to] of getOutOfScopeMappings(mapping)) {
    const tos = new Set([to])

    outOfScopeMapping.set(from, tos)
  }

  applyMappingPretty(mapping)

  return outOfScopeMapping

  async function inflateNode (node: Node): Promise<Map<string, Set<string>>> {
    const promises: Array<Promise<Map<string, Set<string>>>> = []

    ESTraverse.traverse(node, {
      enter (node) {
        if (node === ast) return

        if (NODE_TYPE_BLACKLIST.has(node.type)) return

        this.skip()

        promises.push(inflateScope(node))
      }
    })

    const maps = await Promise.all(promises)

    const outOfScopeMap = new Map<string, Set<string>>()

    for (const map of maps) {
      for (const [from, tos] of map) {
        const set = outOfScopeMap.get(from) ?? new Set()
        outOfScopeMap.set(from, set)

        for (const to of tos) set.add(to)
      }
    }

    return outOfScopeMap
  }

  function getOutOfScopeMappings (mapping: Map<string, string>): Map<string, string> {
    const outOfScopeMapping = new Map<string, string>()

    const localNames = getLocalNames(ast)

    for (const [from, to] of mapping) {
      if (localNames.has(from)) continue

      outOfScopeMapping.set(from, to)
    }

    return outOfScopeMapping
  }

  function applyMappingPretty (mapping: Map<string, string>): void {
    const prettyMapping = new Map<string, string>()

    for (const [from, to] of mapping) {
      prettyMapping.set(from, `/*${to}*/${from}`)
    }

    applyMapping(ast, prettyMapping)
  }
}
