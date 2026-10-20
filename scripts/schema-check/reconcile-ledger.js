#!/usr/bin/env node
// Reconcile production's migration ledger with supabase/migrations/.
//
// WHY THIS EXISTS. supabase_migrations.schema_migrations in production holds
// rows that no file in supabase/migrations/ accounts for, and the repo holds
// files that never produced a ledger row. Issue #78 found the first of them;
// issue #91 is the pass over all of them. The two directions have different
// causes:
//
//   ledger row, no file   The SQL was applied through the Supabase MCP server
//                         or the CLI, which records a row keyed by a 14-digit
//                         timestamp with whatever name the caller gave, and
//                         the file never reached git (or reached it later
//                         under a 0XX name, which is what 008, 009, 018, 022
//                         and 023 say in their own headers).
//   file, no ledger row   The file was pasted into the SQL editor, which
//                         records nothing (007, 043), or never ran at all
//                         (021, per 025's header).
//
// Neither direction is visible from the repo alone, and the from-scratch apply
// (apply-from-scratch.sh) cannot see it either: a migration that is missing
// from the repo does not fail, it is simply absent.
//
// WHAT THIS DOES. Every ledger row is classified against the files on disk by
// rules a reader can check by hand, and the result is recorded in
// scripts/schema-check/ledger-reconciliation.tsv, which is the record the
// next reader consults instead of re-investigating. `check` verifies that
// record against the repo and needs no database, so it runs in the test
// suite; `import` and `classify` take an export of the ledger and need one.
//
// THE EXPORT. Three columns, nothing else:
//
//     select version, name, statements
//     from supabase_migrations.schema_migrations
//     order by version;
//
// As JSON, from psql against the direct (session) connection string:
//
//     psql "$DATABASE_URL" -At -c "select coalesce(json_agg(json_build_object(
//       'version', version, 'name', name, 'statements', statements)
//       order by version), '[]') from supabase_migrations.schema_migrations" \
//       > ledger.json
//
// The dashboard's SQL editor and the Supabase MCP server's execute_sql both
// return the same rows; save them as a JSON array of {version, name,
// statements}. `statements` is text[] in that table and may be omitted, in
// which case the statements comparison is skipped. Do NOT commit the export:
// the statements include data backfills with production row ids. The .tsv
// carries only version, name, verdict, file and a note.
//
// HOW A ROW IS CLASSIFIED (mechanical, in this order):
//
//   tracked-by-name     the row's 0XX number and stem name a file on disk,
//                       e.g. version 018 / name notify_on_reply (CLI push).
//   number-collision    the row's name carries a 0XX prefix that a DIFFERENT
//                       file on disk holds, e.g. 017_slug_aliases_and_backfill
//                       against 017_discord_bridge_opt_out.sql.
//   name-matches-file   the row has no number and some NNN_<name>.sql exists,
//                       e.g. notify_on_reply against 018_notify_on_reply.sql.
//                       The file is the committed record of that run; with
//                       statements present the two bodies are compared.
//   cited-by            a file's text carries the row's 14-digit version, the
//                       convention 026, 038 and 041 already follow.
//   consolidated-by     a file's header cites a range "versions X through Y"
//                       containing the row's version (008 and 009).
//   missing-file        none of the above.
//
// The RECORDED verdict in the .tsv is the human decision and uses this
// vocabulary:
//
//   tracked <file>          the file is the record of this run
//   recovered-by <file>     a later file recreates what this run created
//   consolidated-by <file>  the file captures this run among several
//   number-collision <file> the number is taken; the note names the recovery
//   missing-file            nothing in the repo reproduces it (write one from
//                           the statements column, then change the verdict)
//   no-ledger-row <file>    a repo file with no row in the ledger
//
// `check` fails on a contradiction between the recorded verdict and the repo:
// a verdict naming a file that does not exist, a `missing-file` verdict for a
// version some file now cites, or a `tracked`/`recovered-by`/`consolidated-by`
// verdict naming a file that neither matches the row's name nor cites its
// version. That last rule is what makes "a recovery file cites the production
// version it recovers" enforced rather than customary.
//
// Usage, from the repo root:
//
//     node scripts/schema-check/reconcile-ledger.js check
//     node scripts/schema-check/reconcile-ledger.js classify ledger.json
//     node scripts/schema-check/reconcile-ledger.js import ledger.json
//     node scripts/schema-check/reconcile-ledger.js show ledger.json <version>
//
// `import` appends every export row the .tsv does not hold yet, with its
// mechanical class as the verdict, fills in `?` versions for rows the record
// knows by name only, and leaves recorded verdicts untouched. Review the
// appended rows and change the verdicts you disagree with; `check` then holds
// them.
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', '..')
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations')
const RECORD_PATH = path.join(__dirname, 'ledger-reconciliation.tsv')

const FILE_RE = /^(\d{3})_(.+)\.sql$/
const VERSION_RE = /\b(20\d{12})\b/g
const RANGE_RE = /versions?\s+(20\d{12})\s+(?:through|to|-|–)\s+(20\d{12})/gi

const RECORDED_VERDICTS = new Set([
  'tracked',
  'recovered-by',
  'consolidated-by',
  'number-collision',
  'missing-file',
  'no-ledger-row',
])

// ---------------------------------------------------------------------------
// Repo side
// ---------------------------------------------------------------------------

/**
 * @typedef {{ file: string, number: string, stem: string, body: string,
 *   cites: Set<string>, ranges: Array<[string, string]> }} RepoFile
 */

/**
 * @param {string} [dir]
 * @returns {RepoFile[]}
 */
function parseMigrationsDir(dir = MIGRATIONS_DIR) {
  const out = []
  for (const file of fs.readdirSync(dir).sort()) {
    const m = FILE_RE.exec(file)
    if (!m) continue
    const body = fs.readFileSync(path.join(dir, file), 'utf8')
    // A range cited in a header can wrap across comment lines, as 008's does
    // ("versions 20260805175558\n-- through 20260805181416"), so the comment
    // prefixes are flattened before the range pattern is applied.
    const flattened = body.replace(/\r?\n\s*--\s*/g, ' ')
    const ranges = []
    for (const r of flattened.matchAll(RANGE_RE)) ranges.push([r[1], r[2]])
    const cites = new Set()
    for (const v of body.matchAll(VERSION_RE)) cites.add(v[1])
    out.push({ file, number: m[1], stem: m[2], body, cites, ranges })
  }
  return out
}

// ---------------------------------------------------------------------------
// Ledger side
// ---------------------------------------------------------------------------

/**
 * @typedef {{ version: string, name: string, statements?: string[] | string | null }} LedgerRow
 */

/** @param {LedgerRow} row */
function rowKey(row) {
  const name = (row.name || '').trim()
  const version = (row.version || '').trim()
  const prefixed = /^(\d{3})_(.+)$/.exec(name)
  if (prefixed) return { number: prefixed[1], stem: prefixed[2], name, version }
  if (/^\d{1,3}$/.test(version)) {
    return { number: version.padStart(3, '0'), stem: name, name, version }
  }
  return { number: null, stem: name, name, version }
}

/** @param {string} sql */
function normaliseSql(sql) {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*;\s*/g, ';')
    .trim()
    .toLowerCase()
}

/** @param {LedgerRow} row */
function statementsText(row) {
  const s = row.statements
  if (s == null) return null
  if (Array.isArray(s)) return s.join('\n')
  return String(s)
}

/**
 * identical: the file's SQL, comments removed, is the ledger's SQL.
 * contained: the ledger's SQL appears inside the file's (the file adds more).
 * differ:    neither.
 * @param {LedgerRow} row
 * @param {RepoFile} repoFile
 */
function compareStatements(row, repoFile) {
  const text = statementsText(row)
  if (text == null || text.trim() === '') return 'n/a'
  const a = normaliseSql(text)
  const b = normaliseSql(repoFile.body)
  if (a === b) return 'identical'
  if (a.length > 0 && b.includes(a)) return 'contained'
  return 'differ'
}

/**
 * @typedef {{ class: string, files: string[], colliding?: string,
 *   citedBy: string[], consolidatedBy: string[], mentionedBy: string[],
 *   renumbered: string[], statements: Record<string, string> }} Classification
 */

/**
 * @param {LedgerRow} row
 * @param {RepoFile[]} repo
 * @returns {Classification}
 */
function classify(row, repo) {
  const key = rowKey(row)
  const hasVersion = /^20\d{12}$/.test(key.version)
  const citedBy = hasVersion
    ? repo.filter((f) => f.cites.has(key.version)).map((f) => f.file)
    : []
  const consolidatedBy = hasVersion
    ? repo
        .filter((f) => f.ranges.some(([lo, hi]) => lo <= key.version && key.version <= hi))
        .map((f) => f.file)
    : []
  // A literal mention of the ledger name in a file, informational only. Short
  // names collide with ordinary words, so this is restricted to names long
  // enough to be distinctive, and the name's own file is excluded.
  const mentionedBy =
    key.name.length >= 12
      ? repo
          .filter((f) => f.file !== `${key.number || ''}_${key.stem}.sql` && f.body.includes(key.name))
          .map((f) => f.file)
      : []
  const statements = {}
  const result = { class: '', files: [], citedBy, consolidatedBy, mentionedBy, renumbered: [], statements }

  if (key.number) {
    const sameNumber = repo.filter((f) => f.number === key.number)
    const exact = sameNumber.find((f) => f.stem === key.stem)
    if (exact) {
      result.class = 'tracked-by-name'
      result.files = [exact.file]
      statements[exact.file] = compareStatements(row, exact)
      return result
    }
    // The same stem under another number is a file the repo renumbered after
    // the run, which this repo has done three times (014_relay_failures is
    // 015, 018_discord_bridge_opt_out is 017, 019_save_count_trigger_and_
    // backfill is 020; 020:1-5 tells the story). That file is the row's
    // record, so it outranks both a citation and the colliding file.
    const renumbered = repo.filter((f) => f.stem === key.stem && f.number !== key.number)
    result.renumbered = renumbered.map((f) => f.file)
    for (const f of renumbered) statements[f.file] = compareStatements(row, f)
    if (sameNumber.length > 0) {
      result.class = 'number-collision'
      result.colliding = sameNumber[0].file
      result.files =
        result.renumbered.length > 0 ? result.renumbered : citedBy.length > 0 ? citedBy : [sameNumber[0].file]
      return result
    }
    if (result.renumbered.length > 0) {
      result.class = 'name-matches-file'
      result.files = result.renumbered
      return result
    }
    result.class = citedBy.length > 0 ? 'cited-by' : 'missing-file'
    result.files = citedBy
    return result
  }

  const byStem = repo.filter((f) => f.stem === key.stem)
  if (key.stem && byStem.length > 0) {
    result.class = 'name-matches-file'
    result.files = byStem.map((f) => f.file)
    for (const f of byStem) statements[f.file] = compareStatements(row, f)
    return result
  }
  if (citedBy.length > 0) {
    result.class = 'cited-by'
    result.files = citedBy
    return result
  }
  if (consolidatedBy.length > 0) {
    result.class = 'consolidated-by'
    result.files = consolidatedBy
    return result
  }
  result.class = 'missing-file'
  return result
}

// ---------------------------------------------------------------------------
// The record (.tsv)
// ---------------------------------------------------------------------------

/**
 * @typedef {{ version: string, name: string, verdict: string, file: string,
 *   note: string, line: number }} RecordRow
 */

/**
 * @param {string} text
 * @returns {RecordRow[]}
 */
function parseRecord(text) {
  const rows = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, '')
    if (line.trim() === '' || line.startsWith('#')) continue
    const cols = line.split('\t')
    if (cols.length < 3) {
      throw new Error(`ledger-reconciliation.tsv:${i + 1}: expected at least 3 tab-separated columns, got ${cols.length}`)
    }
    const [version, name, verdict, file = '', note = ''] = cols.map((c) => c.trim())
    rows.push({ version, name, verdict, file, note, line: i + 1 })
  }
  return rows
}

/** @param {RecordRow} r */
function formatRow(r) {
  return [r.version, r.name, r.verdict, r.file, r.note].join('\t')
}

/**
 * Verifies every recorded verdict against the repo. Returns the contradictions
 * as strings (empty means the record holds) plus the pending rows, which are
 * rows the export has to settle and which never fail the check.
 * @param {RecordRow[]} record
 * @param {RepoFile[]} repo
 */
function check(record, repo) {
  const contradictions = []
  const pending = []
  const files = new Map(repo.map((f) => [f.file, f]))
  const accounted = new Set()

  for (const r of record) {
    const where = `line ${r.line} (${r.version} ${r.name})`
    if (!RECORDED_VERDICTS.has(r.verdict)) {
      contradictions.push(`${where}: unknown verdict "${r.verdict}"`)
      continue
    }
    if (r.verdict === 'no-ledger-row') {
      if (!files.has(r.name)) {
        contradictions.push(`${where}: no-ledger-row names ${r.name}, which is not in supabase/migrations`)
      } else {
        accounted.add(r.name)
      }
      continue
    }
    if (r.file && !files.has(r.file)) {
      contradictions.push(`${where}: verdict names ${r.file}, which is not in supabase/migrations`)
      continue
    }
    const hasVersion = /^20\d{12}$/.test(r.version) || /^\d{1,3}$/.test(r.version)
    const c = classify({ version: hasVersion ? r.version : '', name: r.name }, repo)
    const candidates = new Set([...c.files, ...c.citedBy, ...c.consolidatedBy, ...c.mentionedBy])
    if (c.colliding) candidates.add(c.colliding)

    switch (r.verdict) {
      case 'missing-file': {
        if (c.class !== 'missing-file') {
          contradictions.push(
            `${where}: recorded missing-file, but the repo now ${describe(c)}; update the verdict`,
          )
        } else if (!hasVersion) {
          pending.push(`${where}: missing-file, version unknown until the export`)
        }
        break
      }
      case 'number-collision': {
        if (c.class !== 'number-collision') {
          contradictions.push(`${where}: recorded number-collision, but the repo ${describe(c)}`)
        } else if (r.file && !candidates.has(r.file)) {
          contradictions.push(`${where}: ${r.file} neither holds number ${r.name.slice(0, 3)} nor cites or mentions this row`)
        }
        if (r.file) accounted.add(r.file)
        if (!hasVersion) pending.push(`${where}: number-collision, version unknown until the export`)
        break
      }
      case 'tracked':
      case 'recovered-by':
      case 'consolidated-by': {
        if (!r.file) {
          contradictions.push(`${where}: ${r.verdict} needs a file in column 4`)
          break
        }
        // With a version in hand the file has to match the row's name, cite
        // the version or cover it in a range. A bare mention of the name in a
        // header is only enough while the version is still unknown.
        const strong = new Set([...c.files, ...c.citedBy, ...c.consolidatedBy])
        const held = strong.has(r.file) || (!hasVersion && c.mentionedBy.includes(r.file))
        if (!held) {
          if (hasVersion || c.class !== 'missing-file' || r.verdict !== 'consolidated-by') {
            contradictions.push(
              `${where}: ${r.file} neither matches this row's name nor cites version ${r.version || '(unknown)'}; add the citation to its header or change the verdict`,
            )
          } else {
            // consolidated-by with no version yet: the range cannot be checked
            // until the export supplies the version. Held, not failed.
            pending.push(`${where}: consolidated-by ${r.file}, version unknown until the export`)
          }
        } else if (!hasVersion) {
          pending.push(`${where}: ${r.verdict} ${r.file}, version unknown until the export`)
        }
        accounted.add(r.file)
        break
      }
      default:
        break
    }
  }

  const unaccounted = repo.map((f) => f.file).filter((f) => !accounted.has(f))
  return { contradictions, pending, unaccounted }
}

/** @param {Classification} c */
function describe(c) {
  switch (c.class) {
    case 'tracked-by-name':
      return `tracks it by name as ${c.files.join(', ')}`
    case 'number-collision':
      return c.renumbered.length > 0
        ? `holds that number as ${c.colliding} and the same name as ${c.renumbered.join(', ')}`
        : `holds that number as ${c.colliding}`
    case 'name-matches-file':
      return `holds a file with that name: ${c.files.join(', ')}`
    case 'cited-by':
      return `cites its version in ${c.files.join(', ')}`
    case 'consolidated-by':
      return `covers its version in the range cited by ${c.files.join(', ')}`
    default:
      return 'has nothing for it'
  }
}

// ---------------------------------------------------------------------------
// Export handling
// ---------------------------------------------------------------------------

/**
 * @param {string} file
 * @returns {LedgerRow[]}
 */
function readExport(file) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
  const rows = Array.isArray(parsed) ? parsed : parsed.rows || parsed.data
  if (!Array.isArray(rows)) throw new Error(`${file}: expected a JSON array of {version, name, statements}`)
  return rows.map((r) => ({
    version: String(r.version ?? '').trim(),
    name: String(r.name ?? '').trim(),
    statements: r.statements ?? null,
  }))
}

/** @param {Classification} c */
function mechanicalVerdict(c) {
  switch (c.class) {
    case 'tracked-by-name':
    case 'name-matches-file':
    case 'cited-by':
      return { verdict: 'tracked', file: c.files[0] || '' }
    case 'consolidated-by':
      return { verdict: 'consolidated-by', file: c.files[0] || '' }
    case 'number-collision':
      // A renumbered file is the row's record; only a collision with no such
      // file is left for the reader to resolve.
      return c.renumbered.length > 0
        ? { verdict: 'tracked', file: c.renumbered[0] }
        : { verdict: 'number-collision', file: c.files[0] || '' }
    default:
      return { verdict: 'missing-file', file: '' }
  }
}

/** @param {Classification} c */
function mechanicalNote(c) {
  const bits = []
  for (const [file, result] of Object.entries(c.statements)) {
    if (result !== 'n/a') bits.push(`statements ${result} vs ${file}`)
  }
  if (c.colliding) bits.push(`number held by ${c.colliding}`)
  if (c.renumbered.length) bits.push(`same name under another number: ${c.renumbered.join(', ')}`)
  if (c.citedBy.length) bits.push(`version cited by ${c.citedBy.join(', ')}`)
  if (c.consolidatedBy.length) bits.push(`in range cited by ${c.consolidatedBy.join(', ')}`)
  if (c.mentionedBy.length) bits.push(`name mentioned by ${c.mentionedBy.join(', ')}`)
  bits.push('mechanical classification, not yet reviewed')
  return bits.join('; ')
}

/**
 * When the export supplies statements for a row the record already holds by
 * name, the comparison result is the fact the row was waiting for, so it is
 * written into the note rather than left for a second `classify` run.
 * @param {RecordRow} r
 * @param {Classification} c
 */
function appendStatementsNote(r, c) {
  const bits = Object.entries(c.statements)
    .filter(([, result]) => result !== 'n/a')
    .map(([file, result]) => `statements ${result} vs ${file}`)
  if (bits.length === 0) return
  const suffix = `[import: ${bits.join('; ')}]`
  r.note = r.note ? `${r.note} ${suffix}` : suffix
}

/**
 * Merge an export into the record: rows the record does not hold are appended
 * with their mechanical verdict; `?` versions are filled in by name. Returns
 * the new record rows and a summary of what changed.
 * @param {LedgerRow[]} exported
 * @param {RecordRow[]} record
 * @param {RepoFile[]} repo
 */
function importExport(exported, record, repo) {
  const byVersion = new Map(record.filter((r) => /^\d+$/.test(r.version)).map((r) => [r.version, r]))
  const unversioned = record.filter((r) => r.version === '?')
  const added = []
  const resolved = []
  const conflicts = []
  for (const row of exported) {
    const held = byVersion.get(row.version)
    if (held) {
      if (held.name === '?' && row.name) {
        held.name = row.name
        appendStatementsNote(held, classify(row, repo))
        resolved.push(held)
      }
      continue
    }
    const known = unversioned.find((r) => r.name === row.name && r.version === '?')
    if (known) {
      known.version = row.version
      appendStatementsNote(known, classify(row, repo))
      resolved.push(known)
      byVersion.set(row.version, known)
      continue
    }
    const c = classify(row, repo)
    const { verdict, file } = mechanicalVerdict(c)
    const fresh = { version: row.version, name: row.name, verdict, file, note: mechanicalNote(c), line: 0 }
    record.push(fresh)
    byVersion.set(row.version, fresh)
    added.push(fresh)
  }
  const exportedVersions = new Set(exported.map((r) => r.version))
  const absent = record.filter((r) => /^\d+$/.test(r.version) && !exportedVersions.has(r.version))
  // A file recorded as having no ledger row, while the export tracks it by
  // name (a CLI push of the numbered file), is a verdict the export overturns.
  for (const r of record) {
    if (r.verdict !== 'no-ledger-row') continue
    for (const row of exported) {
      const c = classify(row, repo)
      if (c.class === 'tracked-by-name' && c.files.includes(r.name)) {
        conflicts.push(`${r.name} is recorded as no-ledger-row, but the export tracks it as version ${row.version}`)
      }
    }
  }
  return { record, added, resolved, absent, conflicts }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function loadRecord() {
  return parseRecord(fs.readFileSync(RECORD_PATH, 'utf8'))
}

function writeRecord(originalText, rows) {
  // Keep the comment header verbatim; rewrite only the data lines.
  const header = originalText
    .split('\n')
    .filter((l) => l.replace(/\r$/, '').startsWith('#'))
    .join('\n')
  const body = rows.map(formatRow).join('\n')
  fs.writeFileSync(RECORD_PATH, `${header}\n${body}\n`)
}

function main(argv) {
  const [cmd, ...rest] = argv
  const repo = parseMigrationsDir()

  if (cmd === 'check') {
    const record = loadRecord()
    const { contradictions, pending, unaccounted } = check(record, repo)
    for (const p of pending) console.log(`  pending  ${p}`)
    for (const c of contradictions) console.log(`  FAIL     ${c}`)
    console.log()
    console.log(
      `record rows: ${record.length}   contradictions: ${contradictions.length}   pending the export: ${pending.length}   repo files not yet in the record: ${unaccounted.length}`,
    )
    return contradictions.length === 0 ? 0 : 1
  }

  if (cmd === 'classify' || cmd === 'import') {
    if (!rest[0]) {
      console.error(`usage: reconcile-ledger.js ${cmd} <ledger.json>`)
      return 2
    }
    const exported = readExport(rest[0])
    if (cmd === 'classify') {
      for (const row of exported) {
        const c = classify(row, repo)
        const { verdict, file } = mechanicalVerdict(c)
        console.log([row.version, row.name, c.class, verdict, file, mechanicalNote(c)].join('\t'))
      }
      return 0
    }
    const originalText = fs.readFileSync(RECORD_PATH, 'utf8')
    const record = parseRecord(originalText)
    const { added, resolved, absent, conflicts } = importExport(exported, record, repo)
    writeRecord(originalText, record)
    console.log(`appended ${added.length} rows, resolved ${resolved.length} unknown versions or names`)
    for (const r of absent) console.log(`  recorded but absent from this export: ${r.version} ${r.name}`)
    for (const c of conflicts) console.log(`  OVERTURNED  ${c}`)
    console.log('review the appended rows in ledger-reconciliation.tsv, then run `check`.')
    return 0
  }

  if (cmd === 'show') {
    const [file, version] = rest
    if (!file || !version) {
      console.error('usage: reconcile-ledger.js show <ledger.json> <version>')
      return 2
    }
    const row = readExport(file).find((r) => r.version === version)
    if (!row) {
      console.error(`no row with version ${version}`)
      return 1
    }
    console.log(`-- ${row.version} ${row.name}`)
    console.log(statementsText(row) ?? '(no statements column in this export)')
    return 0
  }

  console.error('usage: reconcile-ledger.js check | classify <ledger.json> | import <ledger.json> | show <ledger.json> <version>')
  return 2
}

module.exports = {
  MIGRATIONS_DIR,
  RECORD_PATH,
  parseMigrationsDir,
  rowKey,
  normaliseSql,
  compareStatements,
  classify,
  parseRecord,
  formatRow,
  check,
  readExport,
  importExport,
  mechanicalVerdict,
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)))
}
