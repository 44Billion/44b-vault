/*
  npx -p=esbuild@0.23.0 \
      -p=nostr-tools@2.7.1 \
      -p=@noble/curves@1.4.2 \
      -p=@noble/hashes@1.4.0 \
      node esbuild.js
*/
import * as esbuild from 'esbuild'

await esbuild.build({
  entryPoints: ['nostr.js'],
  outdir: '../modules',
  entryNames: '[name]',
  bundle: true,
  // exclude ../modules/helpers.js from bundle
  external: ['helpers'],
  platform: 'browser',
  format: 'esm',
  // https://caniuse.com/?search=top%20level%20await
  target: ['edge89', 'firefox89', 'chrome89', 'safari15'],
  minify: true
})
