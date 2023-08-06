import * as acorn from 'acorn'
import fs from 'fs'
import * as Terser from 'terser'
import path from 'path'
import md5 from 'md5'

const INPUT_DIRECTORY = 'mapping-in'
const OUTPUT_DIRECTORY = 'mapping-out'

const map = new Map()

function getSegments (code: string): string[] {
  const node = acorn.parse(code, {
    ecmaVersion: 'latest',
    sourceType: 'module'
  })

  const segments: string[] = []

  parseNode(node)

  return segments

  function parseNode (node: acorn.Node): void {
    const segment = code.substring(
      node.start,
      node.end
    )

    segments.push(segment)

    const body = 'body' in node ? node.body : undefined

    if (body === undefined || body === null) return
    if (!(Symbol.iterator in (body as any))) return

    for (const child of (body as any)) parseNode(child)
  }
}

async function getAllFilePaths (directory: string): Promise<string[]> {
  const filePaths = []

  for (const file of await fs.promises.readdir(directory)) {
    const filePath = path.join(directory, file)

    const stat = await fs.promises.stat(filePath)

    if (stat.isDirectory()) {
      const childFilePaths = await getAllFilePaths(filePath)

      filePaths.push(...childFilePaths)

      continue
    }

    filePaths.push(filePath)
  }

  return filePaths
}

for (const directory of await fs.promises.readdir(INPUT_DIRECTORY)) {
  const filePromises = []

  for (const file of await getAllFilePaths(`${INPUT_DIRECTORY}/${directory}`)) {
    if (!file.endsWith('.js')) continue
    if (file.endsWith('.min.js')) continue

    filePromises.push((async () => {
      try {
        const code = await fs.promises.readFile(file, 'utf8')

        const segments = getSegments(code)

        const segmentPromises = []

        for (const segment of segments) {
          segmentPromises.push((async () => {
            const minified = await Terser.minify(segment)
            const minifiedCode = minified.code

            if (minifiedCode === undefined) return

            const hash = md5(minifiedCode)

            if (map.has(hash)) return

            map.set(
              hash,
              segment
            )
          })())
        }

        await Promise.all(segmentPromises)
      } catch (error) {
        console.error(error)
      }
    })())
  }

  console.time(directory)

  await Promise.all(filePromises)

  console.timeEnd(directory)

  const json = JSON.stringify(Object.fromEntries(map.entries()))

  await fs.promises.writeFile(`${OUTPUT_DIRECTORY}/${directory}.json`, json)
}
