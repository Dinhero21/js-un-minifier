import fs from 'fs'

import { db, hashCode, parse } from './shared.js'
import * as acorn from 'acorn'

const NODE_TYPE_BLACKLIST = new Set([
  'Identifier',
  'Literal',
  'ThisExpression'
])

const INPUT_FILE = 'inflate/in.js'
const OUTPUT_FILE = 'inflate/out.js'

const input = await fs.promises.readFile(INPUT_FILE, 'utf8')

let found = 0

const interval = setInterval(logPercentage, 1000 / 12)

const output = await applyMappings(input)

await fs.promises.writeFile(OUTPUT_FILE, output)

clearInterval(interval)

logPercentage()
console.log('Done!')

async function applyMappings (code: string): Promise<string> {
  const ast = parse(code)

  const segments = code.split('')

  await inflate(ast)

  return segments.join('')

  async function inflate (node: acorn.Node): Promise<void> {
    if (NODE_TYPE_BLACKLIST.has(node.type)) return

    const start = node.start
    const end = node.end

    const segment = code.substring(
      start,
      end
    )

    let hash: string | undefined

    try {
      hash = hashCode(segment)
    } catch (error) {}

    if (hash === undefined) {
      await inflateNodeValues(node)
      return
    }

    const inflated = await db.get(hash)

    if (inflated === null) {
      await inflateNodeValues(node)
      return
    }

    found += segment.length

    segments[start] = inflated

    for (let i = start + 1; i < end; i++) {
      segments[i] = ''
    }

    async function inflateNodeValues (node: acorn.Node): Promise<void> {
      for (const value of Object.values(node)) await inflateNodeValue(value)
    }

    async function inflateNodeValue (value: any): Promise<void> {
      if (typeof value !== 'object') return
      if (value === null) return

      if (Symbol.iterator in value) {
        for (const data of value) await inflateNodeValue(data)

        return
      }

      if (value instanceof acorn.Node) await inflate(value)
    }
  }
}

function logPercentage (): void {
  console.clear()
  console.info(`${((found / input.length) * 100).toPrecision(5)}%`)
}
