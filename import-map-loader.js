import { readFile } from 'fs/promises'
import { pathToFileURL } from 'url'
import { resolve as resolvePath, dirname } from 'path'

// Load the import map
const importMapPath = resolvePath(process.cwd(), 'docs/import-map.json')
const importMapData = JSON.parse(await readFile(importMapPath, 'utf8'))
const imports = importMapData.imports

export async function resolve (specifier, context, nextResolve) {
  // Check if the specifier is in our import map
  if (imports[specifier]) {
    // Convert relative path to absolute file URL
    const importMapDir = dirname(importMapPath)
    const resolvedPath = resolvePath(importMapDir, imports[specifier])
    return {
      url: pathToFileURL(resolvedPath).href,
      shortCircuit: true
    }
  }

  // If not in import map, use default resolution
  return nextResolve(specifier, context)
}
