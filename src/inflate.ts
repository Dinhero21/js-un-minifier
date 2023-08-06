import * as acorn from 'acorn'
import fs from 'fs'
import md5 from 'md5'
import { createClient } from 'redis'
import { type MinifyOutput } from 'terser'
import { minify, BLACKLIST } from './shared.js'

const client = createClient()

await client.connect()

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
  const node = acorn.parse(code, {
    ecmaVersion: 'latest',
    sourceType: 'module'
  })

  let strings = code.split('')

  await inflate(node)

  return strings.join('')

  async function inflate (node: acorn.Node): Promise<void> {
    if (BLACKLIST.has(node.type)) return

    const start = node.start
    const end = node.end

    const original = code.substring(
      start,
      end
    )

    let minified: MinifyOutput | undefined

    try {
      minified = await minify(original)
    } catch (error) {}

    if (minified === undefined) {
      await inflateNodeValues(node)
      return
    }

    const minifiedCode = minified.code

    if (minifiedCode === undefined) {
      await inflateNodeValues(node)
      return
    }

    const hash = md5(minifiedCode)

    const inflated = await client.get(hash)

    if (inflated === null) {
      await inflateNodeValues(node)
      return
    }

    found += original.length

    const inflatedStrings = [...strings]

    inflatedStrings[start] = inflated

    for (let i = start + 1; i < end; i++) {
      inflatedStrings[i] = ''
    }

    const inflatedCode = inflatedStrings.join('')

    let valid: boolean | undefined

    try {
      acorn.parse(code, {
        ecmaVersion: 'latest',
        sourceType: 'module'
      })

      valid = true
    } catch (error) {
      valid = false
    }

    if (!valid) return

    strings = inflatedStrings

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
  console.info(`${(found / input.length).toPrecision(5)}%`)
}
