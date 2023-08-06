import * as acorn from 'acorn'
import fs from 'fs'
import md5 from 'md5'
import * as Terser from 'terser'

const INPUT_DIRECTORY = 'mapping-out'
const INPUT_FILE = 'inflate/in.js'
const OUTPUT_FILE = 'inflate/out.js'

let code = await fs.promises.readFile(INPUT_FILE, 'utf8')

async function applyMappings (code: string, map: Record<string, string>): Promise<string> {
  const node = acorn.parse(code, {
    ecmaVersion: 'latest',
    sourceType: 'module'
  })

  const strings: string[] = []

  for (let i = 0; i < code.length; i++) strings[i] ??= code[i]

  await inflate(node)

  return strings.join('')

  async function inflate (node: acorn.Node): Promise<void> {
    const start = node.start
    const end = node.end

    const original = code.substring(
      start,
      end
    )

    const minified = await Terser.minify(original)
    const minifiedCode = minified.code

    if (minifiedCode === undefined) {
      await inflateBody()
      return
    }

    const hash = md5(minifiedCode)

    const unminified = map[hash]

    if (unminified === undefined) {
      await inflateBody()
      return
    }

    strings[start] = unminified

    for (let i = start + 1; i < end + 1; i++) {
      strings[i] = ''
    }

    async function inflateBody (): Promise<void> {
      const body = 'body' in node ? node.body : undefined

      if (body === undefined || body === null) return
      if (!(Symbol.iterator in (body as any))) return

      for (const child of (body as any)) await inflate(child)
    }
  }
}

for (const file of await fs.promises.readdir(INPUT_DIRECTORY)) {
  console.info('Applying mapping:', file)

  const rawMap = await fs.promises.readFile(`${INPUT_DIRECTORY}/${file}`, 'utf8')
  const map = JSON.parse(rawMap) as Record<string, string>

  code = await applyMappings(code, map)
}

console.info('All mappings applied!')

await fs.promises.writeFile(OUTPUT_FILE, code)
