#!/usr/bin/env node

/**
 * Syncs the import map from import-map.json into index.html
 * Run this script whenever you update import-map.json
 */

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const docsDir = join(__dirname, 'docs')
const importMapPath = join(docsDir, 'import-map.json')
const indexPath = join(docsDir, 'index.html')

// Read the import map
const importMap = JSON.parse(readFileSync(importMapPath, 'utf-8'))

// Read the HTML file
let html = readFileSync(indexPath, 'utf-8')

// Create the inline import map script
const inlineImportMap = `  <script type="importmap">
  ${JSON.stringify(importMap, null, 2)}
  </script>`

// Replace the import map in the HTML
const importMapRegex = / {2}<script type="importmap">[\s\S]*? {2}<\/script>/
if (importMapRegex.test(html)) {
  html = html.replace(importMapRegex, inlineImportMap)
} else {
  console.error('Could not find import map script block in index.html')
  process.exit(1)
}

// Write the updated HTML
writeFileSync(indexPath, html, 'utf-8')

console.log('✅ Import map synced from import-map.json to index.html')
