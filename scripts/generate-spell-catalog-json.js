#!/usr/bin/env node
// Regenerates src/lib/data/spell-catalog.json from src/lib/data/CrossClassSpellCatalog.lua.
//
// The JSON is the candidate the catalog loader tries FIRST, ahead of the Lua, so
// refreshing the Lua on its own changes nothing at runtime -- the stale JSON beside
// it still wins. Both files have to move together, and this script is what makes
// that a single step instead of a thing to remember.
//
// The Lua is a byte copy of the addon's own ems/Data/CrossClassSpellCatalog.lua,
// which is generated from SimC by tools/regen_spell_catalog.py. Nothing here
// re-derives spell data; this only reshapes what that file already says, using the
// same parser the site itself uses so the JSON cannot disagree with the Lua about
// what a block means.
//
// Usage:
//   npm run generate:spell-catalog
//   (commit the updated src/lib/data/spell-catalog.json with the .lua it came from)
const fs = require('fs')
const path = require('path')

const { parseLuaCatalog } = require('../src/lib/workshop/scripts/parseSpellCatalogLua')

const ROOT = path.join(__dirname, '..')
const SOURCE_NAME = 'CrossClassSpellCatalog.lua'
const IN_FILE = path.join(ROOT, 'src', 'lib', 'data', SOURCE_NAME)
const OUT_FILE = path.join(ROOT, 'src', 'lib', 'data', 'spell-catalog.json')

function main() {
  if (!fs.existsSync(IN_FILE)) {
    console.error(`ERROR: source catalog not found at ${IN_FILE}`)
    process.exitCode = 1
    return
  }

  const source = fs.readFileSync(IN_FILE, 'utf8')
  const { version, spells, byClass } = parseLuaCatalog(source)

  // A parse that yields nothing is a broken catalog, not an empty one. Writing it
  // would replace a working index with {} and the failure would only surface later
  // as spells silently not resolving.
  const spellCount = Object.keys(spells).length
  if (!spellCount) {
    console.error('ERROR: parsed zero spells -- refusing to overwrite the JSON')
    process.exitCode = 3
    return
  }
  if (!version) {
    console.error('ERROR: no "-- Patch:" line found -- refusing to write an unversioned catalog')
    process.exitCode = 3
    return
  }

  // Key order and names match the file this replaces; the loader reads these
  // names and a new schema would be a silent break.
  const payload = {
    version,
    source: SOURCE_NAME,
    generatedAt: new Date().toISOString(),
    spellCount,
    spells,
    byClass
  }

  fs.writeFileSync(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  const classCount = Object.keys(byClass).length
  console.log(`version     ${version}`)
  console.log(`spellCount  ${spellCount}`)
  console.log(`classes     ${classCount}`)
  console.log(`wrote       ${path.relative(ROOT, OUT_FILE)}`)
}

main()
