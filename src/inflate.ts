import fs from 'fs'
import { applyMapping, createMapping, db, getNames, hashCode, parse } from './shared.js'
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

console.info('Predicting mappings...')

const mappings = await predictMappings(ast)

console.info('Listing names...')

const names = getNames(ast)

const TOTAL_MAPPED_NAME_COUNT = Array.from(mappings.values()).reduce((a, b) => a + b.size, 0)
const UNIQUE_MAPPED_NAME_COUNT = mappings.size
const NAME_COUNT = names.size

console.info(`Predicted ${TOTAL_MAPPED_NAME_COUNT} names (${UNIQUE_MAPPED_NAME_COUNT} unique) out of ${NAME_COUNT} (${(UNIQUE_MAPPED_NAME_COUNT / NAME_COUNT * 100).toFixed(2)}%)`)

console.info('Generating mapping...')

const mapping = new Map<string, string>()

for (const [from, tos] of mappings) {
  mapping.set(from, `/*${Array.from(tos).join(',')}*/${from}`)
}

console.info('Applying mapping...')

applyMapping(ast, mapping)

console.info('Generating output...')

const output = generate(ast)

console.info('Writing output...')

await fs.promises.writeFile(OUTPUT_FILE, output)

console.info('Done!')

async function predictMappings (ast: Node, mappings = new Map<string, Set<string>>()): Promise<Map<string, Set<string>>> {
  const hash = hashCode(ast)

  const rawNames = await db.get(hash)

  if (rawNames === null) {
    await inflateNode(ast)
    return mappings
  }

  const nameArray = JSON.parse(rawNames)

  if (!Array.isArray(nameArray)) throw new TypeError('Expected array')

  const to = new Set(nameArray)

  const from = getNames(ast)

  const map = createMapping(from, to)

  for (const [from, to] of map) {
    const set = mappings.get(from) ?? new Set()
    mappings.set(from, set)

    set.add(to)
  }

  async function inflateNode (node: Node): Promise<void> {
    const promises: Array<Promise<any>> = []

    ESTraverse.traverse(node, {
      enter (node) {
        if (NODE_TYPE_BLACKLIST.has(node.type)) return

        this.skip()

        promises.push(predictMappings(node, mappings))
      }
    })

    await Promise.all(promises)
  }

  return mappings
}
