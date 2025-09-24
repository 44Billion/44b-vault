const toKebabCase = string =>
  string
    .replace(
      /\.?([A-Z0-9]+)/g,
      (_match, chars) => '-' + chars.toLowerCase()
    ).replace(/^-/, '')

const toAllCaps = string =>
  string
    .replace(
      /\.?([A-Z0-9]+)/g,
      (_match, chars) => '_' + chars
    )
    .replace(/^_/, '')
    .toUpperCase()

export {
  toKebabCase,
  toAllCaps
}
