// Credit: Beard3d_Gamer — keyPressExtract.js converted to TypeScript

export interface Block {
  kind: string
  text?: string
  children?: Block[]
  [key: string]: unknown
}

function splitMacroLines(text: string): string[] {
  return String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
}

function joinMacroLines(lines: string[]): string {
  return lines.filter(Boolean).join('\n')
}

function isMacroBlock(block: Block | null | undefined): boolean {
  return (block?.kind === 'Action' || block?.kind === 'Repeat') && Boolean(block?.text)
}

function collectActionTexts(blocks: Block[], output: string[] = []): string[] {
  for (const block of blocks || []) {
    if (isMacroBlock(block)) output.push(block.text!)
    if (block?.children?.length) collectActionTexts(block.children, output)
  }
  return output
}

function requiredOccurrences(actionCount: number): number {
  if (actionCount < 2) return actionCount
  if (actionCount === 2) return 2
  return actionCount - 1
}

export function findCommonLinePrefix(texts: string[]): string[] {
  if (!Array.isArray(texts) || texts.length < 2) return []
  const lineLists = texts.map(splitMacroLines)
  const minLength = Math.min(...lineLists.map(l => l.length))
  let prefixLength = 0
  for (let i = 0; i < minLength; i++) {
    const line = lineLists[0][i]
    if (lineLists.every(lines => lines[i] === line)) prefixLength++
    else break
  }
  return prefixLength > 0 ? lineLists[0].slice(0, prefixLength) : []
}

function findSharedLines(texts: string[]): string[] {
  if (!Array.isArray(texts) || texts.length < 2) return []
  const lineLists = texts.map(splitMacroLines)
  const minimumMatches = requiredOccurrences(texts.length)
  const orderSource = lineLists.reduce((longest, lines) => lines.length > longest.length ? lines : longest, lineLists[0])
  const seen = new Set<string>()
  return orderSource.filter(line => {
    if (seen.has(line)) return false
    seen.add(line)
    return lineLists.filter(lines => lines.includes(line)).length >= minimumMatches
  })
}

function applyLineRemovalToBlocks(blocks: Block[], linesToRemove: string[]): Block[] {
  const removeSet = new Set(linesToRemove)
  if (!removeSet.size) return blocks
  return (blocks || []).map(block => {
    if (isMacroBlock(block)) {
      const text = joinMacroLines(splitMacroLines(block.text!).filter(l => !removeSet.has(l)))
      if (!text) return null
      return { ...block, text }
    }
    if (block.children?.length) {
      const children = applyLineRemovalToBlocks(block.children, linesToRemove)
      if (!children.length) return null
      return { ...block, children }
    }
    return block
  }).filter(Boolean) as Block[]
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

function extractCommonKeyPress(blocks: Block[]): { blocks: Block[]; keyPress: string; commonLineCount: number } {
  const actionTexts = collectActionTexts(blocks)
  const sharedLines = findSharedLines(actionTexts)
  if (!sharedLines.length) return { blocks, keyPress: '', commonLineCount: 0 }
  return {
    blocks: applyLineRemovalToBlocks(blocks, sharedLines),
    keyPress: joinMacroLines(sharedLines),
    commonLineCount: sharedLines.length,
  }
}

function stripKeyPressLinesFromBlocks(blocks: Block[], keyPress: string): Block[] {
  const keyPressLines = new Set(splitMacroLines(keyPress))
  if (!keyPressLines.size) return blocks
  return applyLineRemovalToBlocks(blocks, [...keyPressLines])
}

function hasLineSourceChildren(children: Block[]): boolean {
  return (children || []).filter(c => isMacroBlock(c)).length >= 2
}

function filterBlocksWithContent(blocks: Block[]): Block[] {
  return (blocks || []).filter(block => {
    if (block.kind === 'Loop') return block.children?.length
    return Boolean(block.text)
  })
}

function applyLoopKeyPressPasses(blocks: Block[], keyPressParts: string[]): Block[] {
  return (blocks || []).map(block => {
    if (block.kind !== 'Loop') return block
    let children = block.children || []
    if (hasLineSourceChildren(children)) {
      const loopExtract = extractCommonKeyPress(children)
      if (loopExtract.keyPress) keyPressParts.push(loopExtract.keyPress)
      children = filterBlocksWithContent(loopExtract.blocks)
    } else {
      children = applyLoopKeyPressPasses(children, keyPressParts)
    }
    if (!children.length) return null
    return { ...block, children }
  }).filter(Boolean) as Block[]
}

export function extractKeyPressFromVersion(blocks: Block[]): { blocks: Block[]; keyPress: string; commonLineCount: number } {
  const keyPressParts: string[] = []
  const global = extractCommonKeyPress(blocks)
  if (global.keyPress) keyPressParts.push(global.keyPress)
  let nextBlocks = applyLoopKeyPressPasses(global.blocks, keyPressParts)
  const keyPress = mergeKeyPress(...keyPressParts)
  nextBlocks = stripKeyPressLinesFromBlocks(nextBlocks, keyPress)
  return { blocks: nextBlocks, keyPress, commonLineCount: splitMacroLines(keyPress).length }
}
