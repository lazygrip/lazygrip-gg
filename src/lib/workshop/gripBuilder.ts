import { encodeEMSExport, GRIP_PREFIX, GRIP_FORMAT_VERSION } from "./emsEncoder";
import {
  buildEnvelopeFields,
  buildCollectionExportMeta,
  enrichSequencePayload,
  resolveExportAuthor,
  variablesToExportMap,
  macrosToExportMap
} from "./gripExportEnrich";
import type { BuildResult, BuilderModel } from "./types";
import { MAX_BUILD_DEPTH, MAX_BUILD_STEPS } from "./limits";
import { formatMacroForGripExport } from "./spellCatalog";
import { exportResetModifiers } from "./gripResetModifiers";

type LooseRecord = Record<string, any>;

const DEFAULT_ICON = 134400;
const STEP_FUNCTIONS = new Set(["Sequential", "Priority", "Random", "ReversePriority"]);
const LOOP_REPEAT_MAX = 50;

// ONE BUDGET FOR THE WHOLE BUILD, not one per version.
//
// clampLoopRepeat bounds a SINGLE loop at LOOP_REPEAT_MAX, and that was the only
// bound the builder had. walk() recursed into child loops with no depth counter
// and steps had no length ceiling, so the repeats multiplied. Measured on the
// uncapped builder at repeat 50: depth 1 emits 50 steps, depth 2 2,500, depth 3
// 125,000, and depth 4 6,250,000 in 8.2 seconds. Depth 5 is 312,500,000 and
// depth 6 is 15.6 billion, from a request body under 400 bytes, unauthenticated.
//
// A per-version budget would not have been enough. model.sequences and
// sequence.versions are both uncapped arrays, so a budget that resets per
// version multiplies straight back out -- six versions of a 1,000-step build is
// 6,000 steps with every individual version comfortably legal. The budget is
// therefore created once in buildGripFromModel and threaded down.
type StepBudget = { remaining: number };

function createStepBudget(): StepBudget {
  return { remaining: MAX_BUILD_STEPS };
}

function spendStep(budget: StepBudget): void {
  if (budget.remaining <= 0) {
    throw new Error(
      `That build produces too many steps (the limit is ${MAX_BUILD_STEPS.toLocaleString()}). `
      + "Reduce the loop repeat counts or the nesting."
    );
  }
  budget.remaining -= 1;
}

// Checked on descent, in both traversals of the action tree, because they are
// two independent walks of the same untrusted input: createActionNormalizer maps
// it one-to-one, and buildGripFlatSteps flattens it multiplicatively. Bounding
// only the second would leave the first able to blow the stack.
function assertDepthWithinLimit(depth: number): void {
  if (depth > MAX_BUILD_DEPTH) {
    throw new Error(
      `That build is nested too deep (the limit is ${MAX_BUILD_DEPTH} levels of loops and ifs).`
    );
  }
}

function normalizeStepFunction(stepFunction: unknown): string {
  const value = String(stepFunction || "").trim();
  if (!value) {
    return "Sequential";
  }

  const match = [...STEP_FUNCTIONS].find(name => name.toLowerCase() === value.toLowerCase());
  return match || "Sequential";
}

function clampLoopRepeat(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.min(LOOP_REPEAT_MAX, Math.floor(parsed));
}

function buildGripFlatSteps(actions: LooseRecord[], budget: StepBudget): string[] {
  const steps: string[] = [];
  const disabledSeen = new Set();

  function appendAction(node: LooseRecord): void {
    const macro = formatMacroForGripExport(node.macro || "");
    if (!macro.trim()) {
      return;
    }

    if (node.disabled) {
      const key = node.id || macro;
      if (disabledSeen.has(key)) {
        return;
      }
      disabledSeen.add(key);
    }

    spendStep(budget);
    steps.push(macro);
  }

  // EVERY RECURSIVE DESCENT PASSES depth EXPLICITLY, and none of them is written
  // as `children.forEach(walk)` any more. Array.prototype.forEach hands its
  // callback (item, index, array), so a walk(node, depth) reached through a bare
  // forEach reference receives the ARRAY INDEX as its depth -- a counter that
  // looks threaded, reads plausibly, and is wrong. The audit records exactly that
  // shape already living in normalizeGripAction, which threads a depth parameter
  // that nothing ever compares.
  function walk(node: LooseRecord, depth: number): void {
    if (!node || typeof node !== "object") {
      return;
    }

    const type = String(node.type || "action").toLowerCase();
    if (type === "action") {
      appendAction(node);
      return;
    }

    if (type === "loop") {
      assertDepthWithinLimit(depth + 1);
      const repeat = clampLoopRepeat(node.repeat);
      const children = node.children || [];
      for (let round = 0; round < repeat; round += 1) {
        children.forEach((child: LooseRecord) => walk(child, depth + 1));
      }
      return;
    }

    if (type === "if") {
      assertDepthWithinLimit(depth + 1);
      (node.then || []).forEach((child: LooseRecord) => walk(child, depth + 1));
      (node.else || []).forEach((child: LooseRecord) => walk(child, depth + 1));
      return;
    }

    if (type === "pause") {
      const clicks = Number(node.clicks);
      spendStep(budget);
      steps.push(Number.isFinite(clicks) && clicks > 0
        ? `/pause ${Math.floor(clicks)} clicks`
        : "/pause 1 clicks");
      return;
    }

    if (type === "embed") {
      const sequence = String(node.sequence || "").trim();
      if (sequence) {
        spendStep(budget);
        steps.push(`/embed ${sequence}`);
      }
    }
  }

  (actions || []).forEach((action: LooseRecord) => walk(action, 0));
  return steps;
}

function normalizeExportVariables(variables: LooseRecord[] | null | undefined): LooseRecord[] {
  return (variables || [])
    .map((variable: LooseRecord) => {
      const name = String(variable?.name || "").trim();
      if (!name) {
        return null;
      }

      const entry: LooseRecord = { name };
      const description = String(variable?.description || "").trim();
      const value = String(variable?.value || "").trim();
      const fn = String(variable?.function || "").trim();
      const type = variable?.type === "text" || variable?.type === "function"
        ? variable.type
        : (value && !fn ? "text" : "function");

      if (description) {
        entry.description = description;
        entry.comments = description;
      }

      if (type === "text") {
        if (!value) {
          return null;
        }
        entry.value = formatMacroForGripExport(value);
        return entry;
      }

      if (!fn) {
        return null;
      }
      entry.function = fn;
      return entry;
    })
    .filter((entry): entry is LooseRecord => entry !== null);
}

function normalizeExportMacros(macros: LooseRecord[] | null | undefined): Array<{ name: string; macro: string }> {
  return (macros || [])
    .map((item: LooseRecord) => {
      const name = String(item?.name || "").trim();
      const macro = formatMacroForGripExport(item?.macro || "");
      if (!name || !macro.trim()) {
        return null;
      }

      return { name, macro };
    })
    .filter((entry): entry is { name: string; macro: string } => entry !== null);
}

function attachExportResources(payload: LooseRecord, model: BuilderModel, warnings: string[] = []) {
  const variables = variablesToExportMap(model.variables || [], formatMacroForGripExport, warnings);
  const macros = macrosToExportMap(model.standaloneMacros || [], formatMacroForGripExport);

  if (Object.keys(variables).length) {
    payload.variables = variables;
  }
  if (Object.keys(macros).length) {
    payload.Macros = macros;
  }
}

function attachNodeMetadata(target: LooseRecord, action: LooseRecord): LooseRecord {
  const name = String(action.name || action.Name || "").trim();
  const label = String(action.label || action.Label || "").trim();
  if (name) {
    target.name = name;
  }
  if (label) {
    target.label = label;
  }
  if (action.disabled || action.Disabled) {
    target.disabled = true;
  }
  return target;
}

function prefixWarning(contextLabel: string, message: string): string {
  return contextLabel ? `${contextLabel}: ${message}` : message;
}

function createActionNormalizer(warnings: string[], contextLabel: string): (action: LooseRecord) => LooseRecord | null {
  let blockNumber = 0;

  function warn(message: string): void {
    warnings.push(prefixWarning(contextLabel, message));
  }

  function normalize(action: LooseRecord, depth: number = 0): LooseRecord | null {
    if (!action || typeof action !== "object") {
      return null;
    }

    blockNumber += 1;
    const num = blockNumber;
    const type = String(action.type || "action").toLowerCase();

    if (type === "action") {
      const macro = formatMacroForGripExport(action.macro || "");
      if (!macro.trim()) {
        return null;
      }

      const node: LooseRecord = { macro, type: "action" };
      if (action.disabled || action.Disabled) {
        node.disabled = true;
      }
      const interval = Number(action.interval);
      if (Number.isFinite(interval) && interval > 0) {
        node.interval = Math.min(50, Math.max(2, Math.floor(interval)));
      }
      return attachNodeMetadata(node, action);
    }

    if (type === "loop") {
      assertDepthWithinLimit(depth + 1);
      const children = (action.children || [])
        .map((child: LooseRecord) => normalize(child, depth + 1))
        .filter(Boolean);

      if (!children.length) {
        warn(`Loop #${num} has no steps inside — it was left out of the export. Add steps or delete the block.`);
        return null;
      }

      return attachNodeMetadata({
        type: "loop",
        stepFunction: normalizeStepFunction(action.stepFunction),
        repeat: clampLoopRepeat(action.repeat),
        children
      }, action);
    }

    if (type === "pause") {
      const clicks = Number(action.clicks);
      if (Number.isFinite(clicks) && clicks > 0) {
        return attachNodeMetadata({ type: "pause", clicks: Math.floor(clicks) }, action);
      }

      const ms = Number(action.ms);
      if (Number.isFinite(ms) && ms > 0) {
        return attachNodeMetadata({ type: "pause", clicks: Math.max(1, Math.ceil(ms / 250)) }, action);
      }

      return attachNodeMetadata({ type: "pause", clicks: 1 }, action);
    }

    if (type === "if") {
      assertDepthWithinLimit(depth + 1);
      const thenBranch = (action.then || action.children?.[0] || [])
        .map((child: LooseRecord) => normalize(child, depth + 1))
        .filter(Boolean);
      const elseBranch = (action.else || action.children?.[1] || [])
        .map((child: LooseRecord) => normalize(child, depth + 1))
        .filter(Boolean);

      if (!thenBranch.length && !elseBranch.length) {
        warn(`If #${num} has nothing in Then or Else — it was left out of the export. Add steps or delete the block.`);
        return null;
      }

      return attachNodeMetadata({
        type: "if",
        variable: String(action.variable || "= true").trim() || "= true",
        children: [thenBranch, elseBranch]
      }, action);
    }

    if (type === "embed") {
      const sequence = String(action.sequence || action.Sequence || "").trim();
      if (!sequence) {
        warn(`Block #${num} is an embed without a sequence name — it was left out of the export.`);
        return null;
      }

      return attachNodeMetadata({ type: "embed", sequence }, action);
    }

    warn(`Block #${num} uses unsupported type "${type}" — it was left out of the export.`);
    return null;
  }

  return normalize;
}

function buildVersionContextLabel(model: LooseRecord, sequence: LooseRecord, version: LooseRecord, versionIndex: number): string {
  const parts: string[] = [];
  const sequences = Array.isArray(model.sequences) ? model.sequences : [];

  if (sequences.length > 1) {
    parts.push(String(sequence.name || "").trim() || "Untitled");
  }

  const versions = Array.isArray(sequence.versions) ? sequence.versions : [];
  if (versions.length > 1) {
    parts.push(String(version.name || "").trim() || `Version ${versionIndex + 1}`);
  }

  return parts.join(" · ");
}

function buildVersionPayload(version: LooseRecord, warnings: string[], contextLabel: string, budget: StepBudget): LooseRecord {
  const normalize = createActionNormalizer(warnings, contextLabel);
  const sourceActions = version.actions || [];
  const actions = sourceActions
    .map((action: LooseRecord) => normalize(action))
    .filter(Boolean);

  if (!actions.length) {
    throw new Error(prefixWarning(contextLabel, "Add at least one block with macro text."));
  }

  const steps = buildGripFlatSteps(sourceActions, budget);
  if (!steps.length) {
    warnings.push(prefixWarning(contextLabel, "No exportable steps were found in this version."));
  }

  return {
    stepFunction: normalizeStepFunction(version.stepFunction),
    actions,
    steps,
    stepLabels: [],
    keyPress: formatMacroForGripExport(version.keyPress || ""),
    keyRelease: formatMacroForGripExport(version.keyRelease || ""),
    resetOnCombat: Boolean(version.resetOnCombat),
    resetOnTarget: Boolean(version.resetOnTarget),
    resetOnGear: Boolean(version.resetOnGear),
    resetOnSpec: Boolean(version.resetOnSpec),
    resetTimer: Math.max(0, Number(version.resetTimer) || 0),
    repeatCount: Math.min(50, Math.max(1, Number(version.repeatCount) || 1)),
    ...(() => {
      const resetModifiers = exportResetModifiers(version.resetModifiers);
      return resetModifiers ? { resetModifiers } : {};
    })()
  };
}

function buildSequencePayload(sequence: LooseRecord, model: BuilderModel, warnings: string[], budget: StepBudget): LooseRecord {
  const name = String(sequence.name || "").trim() || "Untitled";
  const versions = (sequence.versions || [])
    .map((version: LooseRecord, index: number) => buildVersionPayload(
      version,
      warnings,
      buildVersionContextLabel(model, sequence, version, index),
      budget
    ))
    .filter(Boolean);

  if (!versions.length) {
    throw new Error(`Sequence "${name}" needs at least one version with blocks.`);
  }

  const defaultVersion = Math.min(
    Math.max(1, Number(sequence.defaultVersion) || 1),
    versions.length
  );

  const exportMeta = model.exportMeta || {};

  return {
    name,
    payload: {
      icon: DEFAULT_ICON,
      description: String(sequence.description || "").trim(),
      classID: Number(sequence.classId) || 0,
      specID: sequence.specId ? Number(sequence.specId) : null,
      defaultVersion,
      versions,
      ...enrichSequencePayload(sequence, model, versions)
    } as LooseRecord
  };
}

function buildGripFromModel(model: BuilderModel): BuildResult {
  const warnings: string[] = [];
  const inputSequences = Array.isArray(model.sequences) ? model.sequences : [];

  if (!inputSequences.length) {
    throw new Error("Add at least one sequence to the collection.");
  }

  // Created once, here, and spent by every sequence and version below it. See
  // the StepBudget note at the top of this file for why it is not per version.
  const budget = createStepBudget();
  const builtSequences = inputSequences.map(sequence => buildSequencePayload(sequence, model, warnings, budget));
  const sequenceNames = builtSequences.map(sequence => sequence.name);
  const isCollection = builtSequences.length > 1;
  const exportMeta = model.exportMeta || {};

  let payload: LooseRecord;

  if (isCollection) {
    payload = {
      format: "GRIP-EMS",
      version: GRIP_FORMAT_VERSION,
      type: "COLLECTION",
      ...buildEnvelopeFields(model),
      sequences: {} as LooseRecord
    };

    payload.exportMeta = buildCollectionExportMeta(model, builtSequences);
  } else {
    const sequence = builtSequences[0];
    payload = {
      format: "GRIP-EMS",
      version: GRIP_FORMAT_VERSION,
      name: sequence.name,
      sequence: sequence.payload,
      ...buildEnvelopeFields(model)
    } as LooseRecord;

    // GRIP ImportNative reads decoded.contextOverrides at the payload root
    // (see GRIPExport.lua), not only sequence.contextOverrides.
    const contextOverrides = sequence.payload?.contextOverrides;
    if (
      contextOverrides
      && typeof contextOverrides === "object"
      && !Array.isArray(contextOverrides)
      && Object.keys(contextOverrides).length
    ) {
      payload.contextOverrides = contextOverrides;
    }
  }

  if (isCollection) {
    for (const sequence of builtSequences) {
      payload.sequences[sequence.name] = sequence.payload;
    }
  }

  attachExportResources(payload, model, warnings);

  return {
    export: encodeEMSExport(payload, GRIP_PREFIX),
    format: "GRIP-EMS",
    version: GRIP_FORMAT_VERSION,
    type: isCollection ? "COLLECTION" : "SEQUENCE",
    sequenceCount: builtSequences.length,
    sequenceNames,
    warnings
  };
}

export {
  buildGripFromModel
};
