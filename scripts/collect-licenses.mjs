import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const packages = new Map()
const seen = new Set()
function scan(directory) {
  if (!fs.existsSync(directory))
    return
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!item.isDirectory() || item.name.startsWith('.'))
      continue
    const location = path.join(directory, item.name)
    if (item.name.startsWith('@')) { scan(location); continue }
    const manifest = path.join(location, 'package.json')
    if (!fs.existsSync(manifest))
      continue
    const canonical = fs.realpathSync(location)
    if (seen.has(canonical))
      continue
    seen.add(canonical)
    const p = JSON.parse(fs.readFileSync(manifest, 'utf8'))
    const key = `${p.name}@${p.version}`
    if (!packages.has(key)) {
      const licenses = fs.readdirSync(location).filter(name => /^(?:licen[cs]e|copying|notice)(?:\.|$|-)/i.test(name) && fs.statSync(path.join(location, name)).isFile())
      const texts = licenses.map(name => `--- ${name} ---\n${fs.readFileSync(path.join(location, name), 'utf8')}`)
      packages.set(key, `${key}\nLicense declaration: ${JSON.stringify(p.license || p.licenses || 'See package source')}\n${texts.join('\n\n')}`)
    }
    scan(path.join(location, 'node_modules'))
  }
}
scan(path.join(root, 'node_modules'))
const intro = 'UART Debugger — dependency license reference\n\nThis inventory includes development dependencies as well as libraries bundled in the frontend; not every listed package is shipped in the executable. Electron/Chromium and the bundled font also retain their separately supplied licenses. Original dependency licenses and copyright notices follow.\n\n'
fs.writeFileSync(path.join(root, 'THIRD_PARTY_LICENSES.txt'), intro + [...packages.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value).join('\n\n============================================================\n\n'))
console.log(`Collected ${packages.size} dependency license entries`)
