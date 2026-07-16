type LooseRecord = Record<string, any>;

function splitMacroLines(text: unknown): string[] {
  return String(text || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function joinMacroLines(lines: string[]): string {
  return lines.filter(Boolean).join("\n");
}

function isMacroBlock(block: LooseRecord | null | undefined): boolean {
  return (block?.kind === "Action" || block?.kind === "Repeat") && block.text;
}

function collectActionTexts(blocks: LooseRecord[], output: string[] = []): string[] {
  for (const block of blocks || []) {
    if (isMacroBlock(block)) {
      output.push(block.text);
    }

    if (block?.children?.length) {
      collectActionTexts(block.children, output);
    }
  }

  return output;
}

function requiredOccurrences(actionCount: number): number {
  if (actionCount < 2) {
    return actionCount;
  }
  if (actionCount === 2) {
    return 2;
  }
  return actionCount - 1;
}

function findCommonLinePrefix(texts: string[]): string[] {
  if (!Array.isArray(texts) || texts.length < 2) {
    return [];
  }

  const lineLists = texts.map(splitMacroLines);
  const minLength = Math.min(...lineLists.map(lines => lines.length));
  let prefixLength = 0;

  for (let index = 0; index < minLength; index += 1) {
    const line = lineLists[0][index];
    if (lineLists.every(lines => lines[index] === line)) {
      prefixLength += 1;
    } else {
      break;
    }
  }

  return prefixLength > 0 ? lineLists[0].slice(0, prefixLength) : [];
}

function findSharedLines(texts: string[]): string[] {
  if (!Array.isArray(texts) || texts.length < 2) {
    return [];
  }

  const lineLists = texts.map(splitMacroLines);
  const minimumMatches = requiredOccurrences(texts.length);
  const orderSource = lineLists.reduce(
    (longest, lines) => (lines.length > longest.length ? lines : longest),
    lineLists[0]
  );
  const seen = new Set();

  return orderSource.filter(line => {
    if (seen.has(line)) {
      return false;
    }
    seen.add(line);
    const matches = lineLists.filter(lines => lines.includes(line)).length;
    return matches >= minimumMatches;
  });
}

function applyLineRemovalToBlocks(blocks: LooseRecord[], linesToRemove: string[]): LooseRecord[] {
  const removeSet = new Set(linesToRemove);
  if (!removeSet.size) {
    return blocks;
  }

  return (blocks || [])
    .map(block => {
      if (isMacroBlock(block)) {
        const text = joinMacroLines(splitMacroLines(block.text).filter(line => !removeSet.has(line)));
        if (!text) {
          return null;
        }
        return { ...block, text };
      }

      if (block.children?.length) {
        const children = applyLineRemovalToBlocks(block.children, linesToRemove);
        if (!children.length) {
          return null;
        }
        return { ...block, children };
      }

      return block;
    })
    .filter(Boolean) as LooseRecord[];
}

function mergeKeyPress(...parts: unknown[]): string {
  const lines: string[] = [];
  const seen = new Set();

  for (const part of parts) {
    for (const line of splitMacroLines(part)) {
      if (seen.has(line)) {
        continue;
      }
      seen.add(line);
      lines.push(line);
    }
  }

  return joinMacroLines(lines);
}

function extractCommonKeyPress(blocks: LooseRecord[]): { blocks: LooseRecord[]; keyPress: string; commonLineCount: number } {
  const actionTexts = collectActionTexts(blocks);
  const sharedLines = findSharedLines(actionTexts);

  if (!sharedLines.length) {
    return {
      blocks,
      keyPress: "",
      commonLineCount: 0
    };
  }

  return {
    blocks: applyLineRemovalToBlocks(blocks, sharedLines),
    keyPress: joinMacroLines(sharedLines),
    commonLineCount: sharedLines.length
  };
}

function stripKeyPressLinesFromBlocks(blocks: LooseRecord[], keyPress: unknown): LooseRecord[] {
  const keyPressLines = new Set(splitMacroLines(keyPress));
  if (!keyPressLines.size) {
    return blocks;
  }

  return applyLineRemovalToBlocks(blocks, [...keyPressLines]);
}

function extractKeyPressFromVersion(blocks: LooseRecord[]) {
  const keyPressParts: string[] = [];
  const global = extractCommonKeyPress(blocks);

  if (global.keyPress) {
    keyPressParts.push(global.keyPress);
  }

  let nextBlocks = applyLoopKeyPressPasses(global.blocks, keyPressParts);
  const keyPress = mergeKeyPress(...keyPressParts);
  nextBlocks = stripKeyPressLinesFromBlocks(nextBlocks, keyPress);

  return {
    blocks: nextBlocks,
    keyPress,
    commonLineCount: splitMacroLines(keyPress).length
  };
}

function hasLineSourceChildren(children: LooseRecord[] | null | undefined): boolean {
  return (children || []).filter(child => isMacroBlock(child)).length >= 2;
}

function filterBlocksWithContent(blocks: LooseRecord[] | null | undefined): LooseRecord[] {
  return (blocks || []).filter(block => {
    if (block.kind === "Loop") {
      return block.children?.length;
    }
    return Boolean(block.text);
  });
}

function applyLoopKeyPressPasses(blocks: LooseRecord[], keyPressParts: string[]): LooseRecord[] {
  return (blocks || [])
    .map(block => {
      if (block.kind !== "Loop") {
        return block;
      }

      let children = block.children || [];

      if (hasLineSourceChildren(children)) {
        const loopExtract = extractCommonKeyPress(children);
        if (loopExtract.keyPress) {
          keyPressParts.push(loopExtract.keyPress);
        }
        children = filterBlocksWithContent(loopExtract.blocks);
      } else {
        children = applyLoopKeyPressPasses(children, keyPressParts);
      }

      if (!children.length) {
        return null;
      }

      return { ...block, children };
    })
    .filter(Boolean) as LooseRecord[];
}

export {
  splitMacroLines,
  joinMacroLines,
  collectActionTexts,
  findCommonLinePrefix,
  findSharedLines,
  extractCommonKeyPress,
  extractKeyPressFromVersion,
  stripKeyPressLinesFromBlocks,
  mergeKeyPress
};
