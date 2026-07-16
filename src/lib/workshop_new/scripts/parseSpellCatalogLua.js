function unescapeLuaString(value) {
  return String(value || "").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function parseClassList(value) {
  if (!value) {
    return [];
  }

  return [...value.matchAll(/"([^"]+)"/g)].map(match => match[1].toLowerCase());
}

function parseLuaCatalog(source) {
  const versionMatch = source.match(/^-- Patch:\s*(.+)$/m);
  const blocks = source.match(/\{\s*id\s*=\s*\d+[\s\S]*?\}/g) || [];
  const spells = {};
  const byClass = {};

  for (const block of blocks) {
    const idMatch = block.match(/id\s*=\s*(\d+)/);
    const nameMatch = block.match(/n\s*=\s*"((?:\\"|[^"])*)"/);
    if (!idMatch || !nameMatch) {
      continue;
    }

    const id = idMatch[1];
    const name = unescapeLuaString(nameMatch[1]);
    spells[id] = name;

    const classes = new Set();
    const primaryClass = block.match(/c\s*=\s*"([^"]+)"/);
    if (primaryClass) {
      classes.add(primaryClass[1].toLowerCase());
    }

    const extraClasses = block.match(/cs\s*=\s*\{([\s\S]*?)\}/);
    if (extraClasses) {
      for (const className of parseClassList(extraClasses[1])) {
        classes.add(className);
      }
    }

    for (const className of classes) {
      if (!byClass[className]) {
        byClass[className] = {};
      }
      byClass[className][id] = name;
    }
  }

  return {
    version: versionMatch ? versionMatch[1].trim() : null,
    spells,
    byClass
  };
}

module.exports = {
  parseLuaCatalog,
  unescapeLuaString
};
