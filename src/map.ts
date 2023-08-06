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

for (const directory of await fs.promises.readdir(INPUT_DIRECTORY)) {
  const filePromises: Array<Promise<void>> = []

  let segmentCount = 0

  for (const file of await getAllFilePaths(`${INPUT_DIRECTORY}/${directory}`)) {
    if (!file.endsWith('.js')) continue
    if (file.endsWith('.min.js')) continue

    filePromises.push((async () => {
      const code = await fs.promises.readFile(file, 'utf8')

      const ast = parse(code)

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
    })())
  }

  console.time(directory)

  await Promise.all(filePromises)

  console.timeEnd(directory)

  console.info(`Indexed Segments: ${segmentCount}`)
}

console.info('Done!')
