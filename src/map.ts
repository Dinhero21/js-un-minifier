import fs from 'fs'
import path from 'path'
import ESTraverse from 'estraverse'
import { db, getNames, hashCode, parse } from './shared.js'
import { type Node } from 'estree'

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

const FILES: string[] = await getAllFilePaths(INPUT_DIRECTORY)

let fileCount = 0

for (let fileIndex = 0; fileIndex < FILES.length; fileIndex++) {
  const file = FILES[fileIndex]

  if (!/\.[mc]?js$/.test(file)) continue
  if (/(min|bundle)\.[mc]?js$/.test(file)) continue

  const fileDirectories = file.split('/')

  if (fileDirectories.includes('dist')) continue
  if (fileDirectories.includes('out')) continue

  const code = await fs.promises.readFile(file, 'utf8')

  if (code.length / ((code.match(/(\r?)\n/g) ?? []).length + 1) > 100) continue

  fileCount++

  console.clear()
  console.info(`(${(fileIndex / FILES.length * 100).toFixed(2)}%) ${file}`)
  console.info(`Segments: ${segmentCount}`)

  let ast: Node | undefined
  try {
    ast = parse(code)
  } catch (error) {}

  if (ast === undefined) continue

  const segmentPromises: Array<Promise<void>> = []

  ESTraverse.traverse(ast, {
    enter (node) {
      segmentPromises.push((async () => {
        let hash

        try {
          hash = hashCode(node)
        } catch (error) {}

        if (hash === undefined) return

        segmentCount++

        const names = getNames(node)
        const nameArray = Array.from(names)

        await db.set(
          hash,
          JSON.stringify(nameArray)
        )
      })())
    }
  })

  await Promise.all(segmentPromises)
}

console.clear()
console.info('Done!')
console.info(`Indexed ${segmentCount} segments from ${fileCount} files`)
