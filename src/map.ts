import fs from 'fs'
import path from 'path'
import * as walk from 'acorn-walk'
import { db, hashCode, parse } from './shared.js'

const INPUT_DIRECTORY = 'mapping-in'

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

let segmentCount = 0

const DIRECTORIES = await fs.promises.readdir(INPUT_DIRECTORY)

for (let directoryIndex = 0; directoryIndex < DIRECTORIES.length; directoryIndex++) {
  const directory = DIRECTORIES[directoryIndex]

  const FILES = await getAllFilePaths(`${INPUT_DIRECTORY}/${directory}`)

  for (let fileIndex = 0; fileIndex < FILES.length; fileIndex++) {
    const file = FILES[fileIndex]

    if (!file.endsWith('.js')) continue
    if (file.endsWith('min.js')) continue
    if (file.endsWith('bundle.js')) continue

    const fileDirectories = file.split('/')

    if (fileDirectories.includes('dist')) continue
    if (fileDirectories.includes('out')) continue

    const code = await fs.promises.readFile(file, 'utf8')

    if (code.length / ((code.match(/\//g) ?? []).length + 1) > 100) continue

    console.clear()
    console.info(`(${(directoryIndex / DIRECTORIES.length * 100).toFixed(2)}%) ${directory} `)
    console.info(`(${(fileIndex / FILES.length * 100).toFixed(2)}%) ${file}`)
    console.info(`Segments: ${segmentCount}`)

    let ast
    try {
      ast = parse(code)
    } catch (error) {}

    if (ast === undefined) continue

    const segmentPromises: Array<Promise<void>> = []

    walk.full(ast, node => {
      segmentPromises.push((async () => {
        const segment = code.substring(
          node.start,
          node.end
        )

        let hash

        try {
          hash = hashCode(segment)
        } catch (error) {}

        if (hash === undefined) return

        segmentCount++

        await db.set(
          hash,
          segment
        )
      })())
    })

    await Promise.all(segmentPromises)
  }
}

console.clear()
console.info('Done!')
console.info(`Indexed ${segmentCount} segments`)
