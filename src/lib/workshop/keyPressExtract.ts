// Credit: Beard3d_Gamer — keypress extraction from GSE block arrays

export function splitMacroLines(text: string): string[] {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
}

export function joinMacroLines(lines: string[]): string {
  return lines.filter(Boolean).join('\n')
}

function isMacroBlock(block: Record<string, unknown>): boolean {
  return (block?.kind === 'Action' || block?.kind === 'Repeat') && Boolean(block.text)
}

function collectActionTexts(blocks: Record<string, unknown>[], output: string[] = []): string[] {
  for (const block of blocks || []) {
    if (isMacroBlock(block)) output.push(block.text as string)
    if (Array.isArray(block?.children)) collectActionTexts(block.children as Record<string, unknown>[], output)
  }
  return output
}

function requiredOccurrences(actionCount: number): number {
  if (actionCount < 2) return actionCount
  if (actionCount === 2) return 2
  return actionCount - 1
}

function findSharedLines(texts: string[]): string[] {
  if (!Array.isArray(texts) || texts.length < 2) return []
  const lineLists = texts.map(splitMacroLines)
  const minimumMatches = requiredOccurrences(texts.length)
  const orderSource = lineLists.reduce(
    (longest, lines) => (lines.length > longest.length ? lines : longest),
    lineLists[0]
  )
  const seen = new Set<string>()
  return orderSource.filter(line => {
    if (seen.has(line)) return false
    seen.add(line)
    return lineLists.filter(lines => lines.includes(line)).length >= minimumMatches
  })
}

function applyLineRemovalToBlocks(
  blocks: Record<string, unknown>[],
  linesToRemove: string[]
): Record<string, unknown>[] {
  const removeSet = new Set(linesToRemove)
  if (!removeSet.size) return blocks
  return (blocks || [])
    .map(block => {
      if (isMacroBlock(block)) {
        const text = joinMacroLines(splitMacroLines(block.text as string).filter(line => !removeSet.has(line)))
        if (!text) return null
        return { ...block, text }
      }
      if (Array.isArray(block.children) && block.children.length) {
        const children = applyLineRemovalToBlocks(block.children as Record<string, unknown>[], linesToRemove)
        if (!children.length) return null
        return { ...block, children }
      }
      return block
    })
    .filter(Boolean) as Record<string, unknown>[]
}

export function mergeKeyPress(...parts: string[]): string {
  const lines: string[] = []
  const seen = new Set<string>()
  for (const part of parts) {
    for (const line of splitMacroLines(part)) {
      if (seen.has(line)) continue
      seen.add(line)
      lines.push(line)
    }
  }
  return joinMacroLines(lines)
}

function extractCommonKeyPress(blocks: Record<string, unknown>[]): {
  blocks: Record<string, unknown>[]
  keyPress: string
  commonLineCount: number
} {
  const actionTexts = collectActionTexts(blocks)
  const sharedLines = findSharedLines(actionTexts)
  if (!sharedLines.length) return { blocks, keyPress: '', commonLineCount: 0 }
  return {
    blocks: applyLineRemovalToBlocks(blocks, sharedLines),
    keyPress: joinMacroLines(sharedLines),
    commonLineCount: sharedLines.length,
  }
}

function stripKeyPressLinesFromBlocks(
  blocks: Record<string, unknown>[],
  keyPress: string
): Record<string, unknown>[] {
  const keyPressLines = new Set(splitMacroLines(keyPress))
  if (!keyPressLines.size) return blocks
  return applyLineRemovalToBlocks(blocks, [...keyPressLines])
}

function hasLineSourceChildren(children: Record<string, unknown>[]): boolean {
  return (children || []).filter(child => isMacroBlock(child)).length >= 2
}

function filterBlocksWithContent(blocks: Record<string, unknown>[]): Record<string, unknown>[] {
  return (blocks || []).filter(block => {
    if (block.kind === 'Loop') return Array.isArray(block.children) && (block.children as unknown[]).length > 0
    return Boolean(block.text)
  })
}

function applyLoopKeyPressPasses(
  blocks: Record<string, unknown>[],
  keyPressParts: string[]
): Record<string, unknown>[] {
  return (blocks || [])
    .map(block => {
      if (block.kind !== 'Loop') return block
      let children = (block.children as Record<string, unknown>[]) || []
      if (hasLineSourceChildren(children)) {
        const loopExtract = extractCommonKeyPress(children)
        if (loopExtract.keyPress) keyPressParts.push(loopExtract.keyPress)
        children = filterBlocksWithContent(loopExtract.blocks)
      } else {
        children = applyLoopKeyPressPasses(children, keyPressParts)
      }
      if (!children.length) return null
      return { ...block, children }
    })
    .filter(Boolean) as Record<string, unknown>[]
}

export function extractKeyPressFromVersion(blocks: Record<string, unknown>[]): {
  blocks: Record<string, unknown>[]
  keyPress: string
  commonLineCount: number
} {
  const keyPressParts: string[] = []
  const global = extractCommonKeyPress(blocks)
  if (global.keyPress) keyPressParts.push(global.keyPress)
  let nextBlocks = applyLoopKeyPressPasses(global.blocks, keyPressParts)
  const keyPress = mergeKeyPress(...keyPressParts)
  nextBlocks = stripKeyPressLinesFromBlocks(nextBlocks, keyPress)
  return { blocks: nextBlocks, keyPress, commonLineCount: splitMacroLines(keyPress).length }
}
