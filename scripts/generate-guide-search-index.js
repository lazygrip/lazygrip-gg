#!/usr/bin/env node
// Regenerates src/lib/guide-search-index.ts from the site's own build output.
//
// Run this after `npm run build` any time guide page content changes. It reads the
// actual prerendered HTML for each guide page (not the JSX source), splits it into
// per-section chunks on the <h2 id="..."> markers GuideSection stamps on every
// section heading, and strips each chunk down to plain text. That's deliberate: the
// index this produces reflects exactly what a reader sees rendered on the page, so it
// can't drift out of sync with the source the way a hand-typed copy would, and it
// covers full section body text, not just titles.
//
// Usage:
//   npm run build
//   node scripts/generate-guide-search-index.js
//   (commit the updated src/lib/guide-search-index.ts along with your guide changes)
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const APP_DIR = path.join(ROOT, '.next', 'server', 'app')
const OUT_FILE = path.join(ROOT, 'src', 'lib', 'guide-search-index.ts')

const PAGES = [
  { file: 'guide.html', page: '/guide', pageTitle: 'Overview' },
  { file: 'guide/installation.html', page: '/guide/installation', pageTitle: 'Installation' },
  { file: 'guide/settings.html', page: '/guide/settings', pageTitle: 'Settings' },
  { file: 'guide/how-it-works.html', page: '/guide/how-it-works', pageTitle: 'How it works' },
  { file: 'guide/features-and-behavior.html', page: '/guide/features-and-behavior', pageTitle: 'Features and behavior' },
  { file: 'guide/building-sequences.html', page: '/guide/building-sequences', pageTitle: 'Building sequences' },
  { file: 'guide/from-legacy-program.html', page: '/guide/from-legacy-program', pageTitle: 'Coming from the legacy program' },
  { file: 'guide/validating.html', page: '/guide/validating', pageTitle: 'Validating your work' },
]

function decodeEntities(s) {
  return s
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

function stripTags(html) {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim()
}

const entries = []

for (const { file, page, pageTitle } of PAGES) {
  const fullPath = path.join(APP_DIR, file)
  if (!fs.existsSync(fullPath)) {
    console.error(`Missing build output for ${file} -- run "npm run build" first.`)
    process.exit(1)
  }
  const full = fs.readFileSync(fullPath, 'utf8')
  const mainMatch = full.match(/<main[^>]*>([\s\S]*?)<\/main>/)
  if (!mainMatch) {
    console.error(`No <main> element found in ${file}, skipping.`)
    continue
  }
  const mainHtml = mainMatch[1]

  const sectionRe = /<h2 id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g
  const matches = [...mainHtml.matchAll(sectionRe)]

  for (let i = 0; i < matches.length; i++) {
    const [, id, titleHtml] = matches[i]
    const startIdx = matches[i].index + matches[i][0].length
    const endIdx = i + 1 < matches.length ? matches[i + 1].index : mainHtml.length
    const chunkHtml = mainHtml.slice(startIdx, endIdx)
    entries.push({
      page,
      pageTitle,
      section: stripTags(titleHtml),
      href: `${page}#${id}`,
      body: stripTags(chunkHtml),
    })
  }
}

if (entries.length === 0) {
  console.error('Extracted zero sections -- something is wrong, refusing to overwrite the index.')
  process.exit(1)
}

const header = `// GENERATED FILE -- do not hand-edit. Produced by scripts/generate-guide-search-index.js
// from the site's own build output, so it reflects exactly what's rendered on the page.
// After changing any guide page's content: `.trimEnd() + '\n'
  + '// npm run build && node scripts/generate-guide-search-index.js\n'
  + `// then commit this file alongside the guide change.\n\n`
  + `export type GuideSearchEntry = {\n`
  + `  page: string\n`
  + `  pageTitle: string\n`
  + `  section: string\n`
  + `  href: string\n`
  + `  body: string\n`
  + `}\n\n`
  + `export const GUIDE_SEARCH_INDEX: GuideSearchEntry[] = `

const body = JSON.stringify(entries, null, 2)

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
fs.writeFileSync(OUT_FILE, header + body + '\n')

console.log(`Wrote ${entries.length} sections across ${PAGES.length} pages to ${path.relative(ROOT, OUT_FILE)}`)
