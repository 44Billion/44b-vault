import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

// Register the import map loader
register('./import-map-loader.js', pathToFileURL('./'))
