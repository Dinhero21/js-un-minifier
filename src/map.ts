import fs from 'fs'
import path from 'path'
import md5 from 'md5'
import * as acorn from 'acorn'
import { createClient } from 'redis'
import { minify, BLACKLIST } from './shared.js'

const client = createClient()

await client.connect()

await client.FLUSHALL()

const INPUT_DIRECTORY = 'mapping-in'

function getSegments (code: string, filter: (node: acorn.Node) => boolean): Set<string> {
  const node = acorn.parse(code, {
    ecmaVersion: 'latest',
    // sourceType: 'module',
    allowReserved: true,
    allowReturnOutsideFunction: true,
    allowImportExportEverywhere: true,
    allowAwaitOutsideFunction: true,
    allowSuperOutsideMethod: true,
    allowHashBang: true
  })

  const segments = new Set<string>()

  parseNode(node)

  return segments

  function parseNode (node: acorn.Node): void {
    const segment = code.substring(
      node.start,
      node.end
    )

    segments.add(segment)

    for (const value of Object.values(node)) parseNodeValue(value)
  }

  function parseNodeValue (value: any): void {
    if (typeof value !== 'object') return
    if (value === null) return

    if (Symbol.iterator in value) {
      for (const data of value) parseNodeValue(data)

      return
    }

    if (value instanceof acorn.Node) parseNode(value)
  }
}

async function getAllFilePaths (directory: string): Promise<string[]> {
  const filePaths: string[] = []

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
  const filePromises: Array<Promise<void>> = []

  let segmentCount = 0

  for (const file of await getAllFilePaths(`${INPUT_DIRECTORY}/${directory}`)) {
    if (!file.endsWith('.js')) continue
    if (file.endsWith('.min.js')) continue

    filePromises.push((async () => {
      const code = await fs.promises.readFile(file, 'utf8')

      const segments = getSegments(
        code,
        node => !BLACKLIST.has(node.type)
      )

      segmentCount += segments.size

      const segmentPromises: Array<Promise<void>> = []

      for (const segment of segments) {
        segmentPromises.push((async () => {
          try {
            const minified = await minify(segment)
            const minifiedCode = minified.code

            if (minifiedCode === undefined) return
            if (minifiedCode === '') return

            const hash = md5(minifiedCode)

            await client.set(
              hash,
              segment
            )
          } catch (error) {
            if (!(error instanceof Error)) throw error
            if (error.name === 'SyntaxError') return

            console.error(error)
          }
        })())
      }

      await Promise.all(segmentPromises)
    })())
  }

  console.time(directory)

  await Promise.all(filePromises)

  console.timeEnd(directory)

  console.info(`Indexed Segments: ${segmentCount}`)
}

console.info('Done!')
