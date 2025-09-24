import * as esbuild from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

await esbuild.build({
  absWorkingDir: __dirname,
  entryPoints: ['nostr/index.js'],
  outdir: '../docs/modules',
  entryNames: 'nostr',
  bundle: true,
  // exclude ../modules/helpers.js from bundle
  external: ['helpers'],
  platform: 'browser',
  format: 'esm',
  // https://caniuse.com/?search=top%20level%20await
  target: ['edge89', 'firefox89', 'chrome89', 'safari15'],
  minify: false
})
