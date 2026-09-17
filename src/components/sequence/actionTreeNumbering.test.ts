import { describe, it, expect } from 'vitest'
import { stepNumbersFor, countActionSteps } from './ActionTree'
import type { ActionNode } from '@/types'

// WHAT THIS GUARDS, AND THE DATE IT WOULD HAVE CAUGHT IT.
//
// Until 2026-09-17 ActionTree numbered its steps by mutating a `counter: {n:number}`
// prop during render: `const n = ++counter.n`. Mutating a prop during render is not
// allowed, and React renders twice per commit under StrictMode in development by
// design, so the numbers came out 2, 4, 6 instead of 1, 2, 3 and depended on how
// many times React happened to render. react-hooks/immutability reported it at
// ActionTree.tsx:128 when eslint-config-next 16 landed; it was a real defect, not
// compiler pedantry.
//
// The replacement is stepNumbersFor, which is pure. These cases pin both halves:
// that the numbers are the ones a reader counts, and that calling it repeatedly
// with the same input returns the same answer -- which is the exact property the
// mutating version did not have, and the one a second StrictMode render broke.
//
// The suite runs in a node environment with no renderer (vitest.config.mts:
// environment "node", include src/**/*.test.ts), so the component itself cannot be
// rendered here. That is why the numbering lives in an exported pure function.

// `index`, `depth` and `label` are required on ActionNode and carry no meaning
// for the numbering, which is the point: the numbers come from tree position, not
// from anything a decoder stamped on a node. They are filled with values that
// would be wrong if anything here read them.
const leaf = (text: string, kind: ActionNode['kind'] = 'Step'): ActionNode =>
  ({ index: -1, depth: -1, label: 'unused', kind, text })
const wrap = (kind: ActionNode['kind'], children: ActionNode[]): ActionNode =>
  ({ index: -1, depth: -1, label: 'unused', kind, children })

describe('stepNumbersFor', () => {
  it('numbers a flat list from 1', () => {
    expect(stepNumbersFor([leaf('a'), leaf('b'), leaf('c')])).toEqual([1, 2, 3])
  })

  it('honours an explicit start index', () => {
    expect(stepNumbersFor([leaf('a'), leaf('b')], 7)).toEqual([7, 8])
  })

  it('hands a Loop its start and resumes after everything inside it', () => {
    // a=1, Loop starts at 2 and contains two leaves (2, 3), so d picks up at 4.
    const nodes = [leaf('a'), wrap('Loop', [leaf('b'), leaf('c')]), leaf('d')]
    expect(stepNumbersFor(nodes)).toEqual([1, 2, 4])
    expect(stepNumbersFor((nodes[1] as ActionNode).children!, 2)).toEqual([2, 3])
  })

  it('counts nested wrappers as structure, not as steps', () => {
    // Loop{ If{ a, b }, c } then d: the wrappers take no number of their own.
    const inner = wrap('If', [leaf('a'), leaf('b')])
    const outer = wrap('Loop', [inner, leaf('c')])
    expect(stepNumbersFor([outer, leaf('d')])).toEqual([1, 4])
    expect(stepNumbersFor(outer.children!, 1)).toEqual([1, 3])
    expect(stepNumbersFor(inner.children!, 1)).toEqual([1, 2])
  })

  it('treats both decoder conventions as leaves', () => {
    // emsDecoder emits "Step"; gseDecoder emits "Action" or "Repeat" for the same
    // role. See the kind-naming note in ActionTree.tsx.
    const nodes = [leaf('a', 'Action'), leaf('b', 'Step'), leaf('c', 'Repeat')]
    expect(stepNumbersFor(nodes)).toEqual([1, 2, 3])
  })

  it('gives Pause, Embed and unknown kinds no number of their own', () => {
    // They render a dash rather than a step number, so they must not advance it.
    const nodes = [leaf('a'), wrap('Pause', []), leaf('b')]
    expect(stepNumbersFor(nodes)).toEqual([1, 2, 2])
    expect(countActionSteps(nodes)).toBe(2)
  })

  it('returns the same numbers however many times it is called', () => {
    // THE REGRESSION CASE. The mutating version returned 1,2,3 then 4,5,6 then
    // 7,8,9 for these same nodes, because the counter lived outside the call.
    const nodes = [leaf('a'), wrap('Loop', [leaf('b')]), leaf('c')]
    const first = stepNumbersFor(nodes)
    expect(stepNumbersFor(nodes)).toEqual(first)
    expect(stepNumbersFor(nodes)).toEqual(first)
    expect(first).toEqual([1, 2, 3])
  })

  it('does not mutate the nodes it is given', () => {
    const nodes = [leaf('a'), wrap('Loop', [leaf('b')])]
    const before = JSON.stringify(nodes)
    stepNumbersFor(nodes)
    stepNumbersFor(nodes)
    expect(JSON.stringify(nodes)).toBe(before)
  })

  it('returns an empty array for an empty tree', () => {
    expect(stepNumbersFor([])).toEqual([])
  })
})
