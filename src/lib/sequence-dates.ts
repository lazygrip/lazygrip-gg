import { differenceInDays, format, formatDistance } from 'date-fns'

// ONE RULE FOR HOW A SEQUENCE'S AGE IS SHOWN, USED EVERYWHERE IT IS SHOWN.
//
// Before this helper existed the browse cards said "Posted X - Updated Y"
// while the sequence page, and the profile lists, printed only the original
// posting date. A sequence first posted in August and updated to v2.0 last
// week therefore read "about 2 months ago" right above a "v2.0 current"
// badge, which looks like v2.0 is two months old. Nothing in the data was
// wrong. The page was answering a question nobody asked.
//
// THE RULES
//   Posted   is always the sequence's created_at, and is always shown.
//   Updated  is shown only when the last change is a full day or more after
//            posting, so an autosave or a typo fix right after posting does
//            not announce itself as a revision. Same threshold the cards used.
//   Last change is the later of updated_at and the newest version row's
//            created_at when the caller has one. The sequence page has the
//            version list in hand and passes it; cards and lists do not, and
//            rely on updated_at, which the database now keeps current for
//            every write path (migration 044).

export type SequenceAge = {
  posted: string
  updated: string | null
  text: string
  title: string
}

function parse(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function lastChangeAt(
  updatedAt: string | null | undefined,
  latestVersionAt?: string | null,
): Date | null {
  const a = parse(updatedAt)
  const b = parse(latestVersionAt)
  if (a && b) return a.getTime() >= b.getTime() ? a : b
  return a ?? b
}

export function describeSequenceAge(
  createdAt: string,
  updatedAt: string | null | undefined,
  now: Date,
  latestVersionAt?: string | null,
): SequenceAge {
  const created = parse(createdAt)
  if (!created) return { posted: '', updated: null, text: '', title: '' }

  const posted = formatDistance(created, now, { addSuffix: true })
  const changed = lastChangeAt(updatedAt, latestVersionAt)
  const wasUpdated = !!changed && differenceInDays(changed, created) >= 1
  const updated = wasUpdated && changed ? formatDistance(changed, now, { addSuffix: true }) : null

  const text = updated ? `Posted ${posted} · Updated ${updated}` : `Posted ${posted}`
  const title = updated && changed
    ? `Posted ${format(created, 'MMM d, yyyy')} · Updated ${format(changed, 'MMM d, yyyy')}`
    : `Posted ${format(created, 'MMM d, yyyy')}`

  return { posted, updated, text, title }
}
