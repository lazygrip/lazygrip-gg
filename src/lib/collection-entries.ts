// src/lib/collection-entries.ts
//
// Defensive reader for a collection_sequences value coming out of the database.
//
// The column is jsonb and is supposed to hold an array of CollectionSequenceEntry
// objects, but the database does not enforce that shape. Before migration 043,
// publish_sequence_version took the param as jsonb while the client sent
// JSON.stringify output, so Postgres stored a jsonb scalar string instead of an
// array, and the first .map() on it crashed the prerender and blocked every
// deploy. This function makes the readers survive that class of bad data: an
// array passes through, a string is parsed once inside a try/catch, and
// anything else becomes an empty list, which renders as a normal
// non-collection page instead of an error.

import type { CollectionSequenceEntry } from '@/types'

export function normalizeCollectionEntries(raw: unknown): CollectionSequenceEntry[] {
  if (Array.isArray(raw)) return raw as CollectionSequenceEntry[]
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as CollectionSequenceEntry[]) : []
    } catch {
      return []
    }
  }
  return []
}
