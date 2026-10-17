// scripts/schema-check/reconcile-ledger.test.ts
//
// Holds scripts/schema-check/ledger-reconciliation.tsv against the files in
// supabase/migrations/, and pins the classifier's rules to the real repo
// rather than to a synthetic fixture, so that renaming or renumbering a file
// the record names, or landing a recovery file that does not cite the
// production version it recovers, fails here instead of in the next reader's
// head.
//
// DATED INCIDENT, so a reader can test whether this still earns its place:
//
//   2026-09-18  Issue #78. Production holds 017_slug_aliases_and_backfill at
//               version 20260808194907 while the repo's 017 is
//               017_discord_bridge_opt_out.sql. The recovery went in as 038,
//               and the only thing tying 038 to that production row is the
//               version string in its header. Nothing checked that the string
//               was there, or would notice if 038 were renumbered.
//   2026-09-19  Issue #91 opened for the roughly 25 rows of the same kind,
//               and the full ledger export it needs had still not been posted
//               anywhere. The record that this test holds is what the repo
//               and the #78 thread establish without it; `import` extends it
//               when the export exists.
//
// The classifier is exercised against the real directory on purpose: a test
// against a fixture directory would pass while the repo it is meant to guard
// drifted. The one place a made-up value appears is a VERSION inside a range
// 008 cites, labelled as such, because the real version of that row is
// exactly what the export has not supplied yet.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  RECORD_PATH,
  check,
  classify,
  compareStatements,
  importExport,
  parseMigrationsDir,
  parseRecord,
} from './reconcile-ledger.js'

const repo = parseMigrationsDir()

function byFile(name: string) {
  const f = repo.find((x) => x.file === name)
  if (!f) throw new Error(`${name} is not in supabase/migrations`)
  return f
}

describe('repo side: the citations the record relies on', () => {
  it('038 cites the production version of slug_aliases', () => {
    expect(byFile('038_recover_slug_aliases.sql').cites.has('20260808194907')).toBe(true)
  })

  it('041 cites the production version of get_posting_eligibility', () => {
    expect(byFile('041_sync_get_posting_eligibility.sql').cites.has('20260823023857')).toBe(true)
  })

  it('026 cites the version of its own recorded run', () => {
    expect(
      byFile('026_search_path_hardening_and_rate_limit_ownership.sql').cites.has('20260909174825'),
    ).toBe(true)
  })

  it('003 cites the production version of copy_count_throttle', () => {
    expect(byFile('003_recover_objects_no_migration_creates.sql').cites.has('20260811201135')).toBe(true)
  })

  it('008 and 009 cite the version ranges of their MCP sessions', () => {
    expect(byFile('008_username_onboarding_infrastructure.sql').ranges).toContainEqual([
      '20260805175558',
      '20260805181416',
    ])
    expect(byFile('009_username_onboarding_gate_wiring.sql').ranges).toContainEqual([
      '20260805175606',
      '20260805181547',
    ])
  })
})

describe('classify, against the real migrations directory', () => {
  it('a 0XX name whose number a different file holds is a number collision, recovered where cited', () => {
    const c = classify({ version: '20260808194907', name: '017_slug_aliases_and_backfill' }, repo)
    expect(c.class).toBe('number-collision')
    expect(c.colliding).toBe('017_discord_bridge_opt_out.sql')
    expect(c.files).toEqual(['038_recover_slug_aliases.sql'])
  })

  it('a CLI push of a numbered file is tracked by name', () => {
    const c = classify({ version: '018', name: 'notify_on_reply' }, repo)
    expect(c.class).toBe('tracked-by-name')
    expect(c.files).toEqual(['018_notify_on_reply.sql'])
  })

  it('a plain name with an NNN_<name>.sql on disk matches that file', () => {
    // The version is a placeholder: the row is known by name from #78 only.
    const c = classify({ version: '20260811120000', name: 'notify_on_reply' }, repo)
    expect(c.class).toBe('name-matches-file')
    expect(c.files).toEqual(['018_notify_on_reply.sql'])
  })

  it('a version a file cites is recovered by that file', () => {
    const c = classify({ version: '20260823023857', name: 'add_get_posting_eligibility_rpc' }, repo)
    expect(c.class).toBe('cited-by')
    expect(c.files).toEqual(['041_sync_get_posting_eligibility.sql'])
  })

  it('a version inside a cited range is consolidated by that file', () => {
    // FIXTURE VERSION. 20260805180000 lies inside the range 008 cites; the
    // real version of add_terms_accepted_at_to_profiles is unknown until the
    // export. 009's range overlaps 008's, so both may be reported.
    const c = classify({ version: '20260805180000', name: 'add_terms_accepted_at_to_profiles' }, repo)
    expect(c.class).toBe('consolidated-by')
    expect(c.files).toContain('008_username_onboarding_infrastructure.sql')
  })

  it('a name nothing matches, cites or covers is a missing file', () => {
    const c = classify({ version: '20260809120000', name: 'optimize_rls_policies_sequences_comments' }, repo)
    expect(c.class).toBe('missing-file')
    expect(c.files).toEqual([])
    // 040's header names it; that is reported, and it does not change the class.
    expect(c.mentionedBy).toContain('040_tighten_leftover_grants_and_view_daily_rls.sql')
  })

  it('a 0XX name with no version still detects the collision and the files that mention it', () => {
    const c = classify({ version: '', name: '025_actions_tree_column' }, repo)
    expect(c.class).toBe('number-collision')
    expect(c.colliding).toBe('025_actions_tree_and_version_sync.sql')
    expect(c.mentionedBy).toContain('003_recover_objects_no_migration_creates.sql')
  })
})

describe('statements comparison', () => {
  const file022 = byFile('022_restrict_check_post_rate_limit_grants.sql')

  it('reports contained when the ledger SQL sits inside the file and the file holds more', () => {
    // 022 is the revoke plus the grant; a ledger row that ran only the revoke
    // is inside it, not equal to it.
    const row = {
      version: '20260819000000',
      name: 'restrict_check_post_rate_limit_grants',
      statements: ['REVOKE ALL ON FUNCTION public.check_post_rate_limit(uuid) FROM public, anon;'],
    }
    expect(compareStatements(row, file022)).toBe('contained')
  })

  it('reports identical when the ledger SQL is the whole file, keyword case aside', () => {
    const row = {
      version: '20260819000000',
      name: 'restrict_check_post_rate_limit_grants',
      statements: [
        'REVOKE ALL ON FUNCTION public.check_post_rate_limit(uuid) FROM public, anon;',
        'GRANT EXECUTE ON FUNCTION public.check_post_rate_limit(uuid) TO authenticated;',
      ],
    }
    expect(compareStatements(row, file022)).toBe('identical')
  })

  it('reports identical when nothing but comments and whitespace differ', () => {
    const uncommented = file022.body.replace(/--[^\n]*/g, '').replace(/\n\s*\n/g, '\n')
    expect(compareStatements({ version: 'x', name: 'y', statements: uncommented }, file022)).toBe('identical')
  })

  it('reports differ when the ledger ran something the file does not hold', () => {
    const row = { version: 'x', name: 'y', statements: ['grant execute on function public.check_post_rate_limit(uuid) to anon;'] }
    expect(compareStatements(row, file022)).toBe('differ')
  })

  it('reports n/a without a statements column', () => {
    expect(compareStatements({ version: 'x', name: 'y' }, file022)).toBe('n/a')
    expect(compareStatements({ version: 'x', name: 'y', statements: null }, file022)).toBe('n/a')
  })
})

describe('the committed record', () => {
  const record = parseRecord(readFileSync(RECORD_PATH, 'utf8'))

  it('holds against the repo with no contradictions', () => {
    const { contradictions } = check(record, repo)
    expect(contradictions).toEqual([])
  })

  it('names every row the #78 thread identified', () => {
    const names = new Set(record.map((r) => r.name))
    for (const name of [
      'add_terms_accepted_at_to_profiles',
      'restrict_check_post_rate_limit_grants',
      'notify_on_reply',
      'backfill_display_name_from_username',
      '017_slug_aliases_and_backfill',
      'copy_count_and_increment_fn',
      'add_get_posting_eligibility_rpc',
    ]) {
      expect(names.has(name), `${name} is not in ledger-reconciliation.tsv`).toBe(true)
    }
  })

  it('names 021 and 043, the two files known to have no ledger row', () => {
    const noRow = record.filter((r) => r.verdict === 'no-ledger-row').map((r) => r.name)
    expect(noRow).toContain('021_version_row_macro_parity.sql')
    expect(noRow).toContain('043_fix_publish_sequence_version_collection_type.sql')
  })
})

describe('check, proven to bite', () => {
  it('rejects a verdict naming a file that does not exist', () => {
    const { contradictions } = check(
      parseRecord('20260808194907\t017_slug_aliases_and_backfill\tnumber-collision\t999_nowhere.sql\t'),
      repo,
    )
    expect(contradictions).toHaveLength(1)
    expect(contradictions[0]).toMatch(/999_nowhere\.sql/)
  })

  it('rejects missing-file for a version a file now cites', () => {
    const { contradictions } = check(
      parseRecord('20260823023857\tadd_get_posting_eligibility_rpc\tmissing-file\t\t'),
      repo,
    )
    expect(contradictions).toHaveLength(1)
    expect(contradictions[0]).toMatch(/041_sync_get_posting_eligibility\.sql/)
  })

  it('rejects recovered-by naming a file that does not cite the version', () => {
    const { contradictions } = check(
      parseRecord('20260823023857\tadd_get_posting_eligibility_rpc\trecovered-by\t038_recover_slug_aliases.sql\t'),
      repo,
    )
    expect(contradictions).toHaveLength(1)
    expect(contradictions[0]).toMatch(/add the citation/)
  })

  it('rejects a verdict outside the vocabulary', () => {
    const { contradictions } = check(parseRecord('20260823023857\tx\tduplicate\t\t'), repo)
    expect(contradictions).toHaveLength(1)
    expect(contradictions[0]).toMatch(/unknown verdict/)
  })

  it('holds a consolidated-by row with no version yet as pending, not failed', () => {
    const { contradictions, pending } = check(
      parseRecord('?\tadd_terms_accepted_at_to_profiles\tconsolidated-by\t008_username_onboarding_infrastructure.sql\t'),
      repo,
    )
    expect(contradictions).toEqual([])
    expect(pending).toHaveLength(1)
  })

  it('reports repo files the record does not account for, without failing on them', () => {
    const { contradictions, unaccounted } = check(parseRecord(''), repo)
    expect(contradictions).toEqual([])
    expect(unaccounted).toContain('001_initial_schema.sql')
  })
})

describe('import', () => {
  it('fills in unknown versions and names, appends the rest with a mechanical verdict, and flags overturned rows', () => {
    const record = parseRecord(
      [
        '?\tnotify_on_reply\ttracked\t018_notify_on_reply.sql\tknown by name',
        '20260909174825\t?\ttracked\t026_search_path_hardening_and_rate_limit_ownership.sql\tknown by version',
        '-\t007_posting_verification_gate.sql\tno-ledger-row\t007_posting_verification_gate.sql\texpected',
      ].join('\n'),
    )
    const exported = [
      {
        version: '20260811130000',
        name: 'notify_on_reply',
        // Not what 018 holds, so the comparison has something to report.
        statements: ['create or replace function public.notify_on_reply() returns trigger language plpgsql as $$ begin return new; end $$;'],
      },
      { version: '20260909174825', name: 'search_path_hardening', statements: null },
      { version: '20260809120000', name: 'optimize_rls_policies_remaining_tables', statements: null },
      { version: '007', name: 'posting_verification_gate', statements: null },
    ]
    const { added, resolved, absent, conflicts } = importExport(exported, record, repo)

    expect(record[0].version).toBe('20260811130000')
    expect(record[0].note).toBe('known by name [import: statements differ vs 018_notify_on_reply.sql]')
    expect(record[1].name).toBe('search_path_hardening')
    expect(record[1].note).toBe('known by version')
    expect(resolved).toHaveLength(2)

    expect(added).toHaveLength(2)
    const optimise = added.find((r) => r.name === 'optimize_rls_policies_remaining_tables')
    expect(optimise?.verdict).toBe('missing-file')
    const pushed = added.find((r) => r.version === '007')
    expect(pushed?.verdict).toBe('tracked')
    expect(pushed?.file).toBe('007_posting_verification_gate.sql')

    expect(absent).toEqual([])
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toMatch(/007_posting_verification_gate\.sql/)
  })
})
