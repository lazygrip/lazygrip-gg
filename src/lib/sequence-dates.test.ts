import { describe, expect, it } from 'vitest'
import { describeSequenceAge, lastChangeAt } from './sequence-dates'

const now = new Date('2026-10-07T12:00:00.000Z')

describe('describeSequenceAge', () => {
  it('shows both dates when the last change is a day or more after posting', () => {
    const age = describeSequenceAge('2026-08-17T17:46:02Z', '2026-09-30T18:59:08Z', now)
    expect(age.posted).toBe('about 2 months ago')
    expect(age.updated).toBe('7 days ago')
    expect(age.text).toBe('Posted about 2 months ago · Updated 7 days ago')
    expect(age.title).toMatch(/Posted Aug 1[67], 2026 · Updated Sep 30, 2026|Posted Aug 1[67], 2026 · Updated Oct 1, 2026/)
  })

  it('omits the updated half when the change is within a day of posting', () => {
    const age = describeSequenceAge('2026-10-06T10:00:00Z', '2026-10-06T14:00:00Z', now)
    expect(age.updated).toBeNull()
    expect(age.text).toBe('Posted 1 day ago')
  })

  it('uses the newer version row when updated_at lags behind it', () => {
    const age = describeSequenceAge('2026-08-17T17:46:02Z', '2026-08-17T17:46:02Z', now, '2026-09-30T18:59:08Z')
    expect(age.updated).toBe('7 days ago')
  })

  it('ignores a version row older than updated_at', () => {
    const age = describeSequenceAge('2026-08-17T17:46:02Z', '2026-09-30T18:59:08Z', now, '2026-08-20T00:00:00Z')
    expect(age.updated).toBe('7 days ago')
  })

  it('survives a missing or unparseable updated_at', () => {
    expect(describeSequenceAge('2026-08-17T17:46:02Z', null, now).updated).toBeNull()
    expect(describeSequenceAge('2026-08-17T17:46:02Z', 'not-a-date', now).updated).toBeNull()
  })

  it('returns empty strings for an unparseable created_at instead of throwing', () => {
    expect(describeSequenceAge('nope', null, now).text).toBe('')
  })
})

describe('lastChangeAt', () => {
  it('returns the later of the two and tolerates nulls', () => {
    expect(lastChangeAt('2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z')?.toISOString()).toBe('2026-02-01T00:00:00.000Z')
    expect(lastChangeAt(null, '2026-02-01T00:00:00Z')?.toISOString()).toBe('2026-02-01T00:00:00.000Z')
    expect(lastChangeAt(null, null)).toBeNull()
  })
})
