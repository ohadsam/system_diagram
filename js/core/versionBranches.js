// Lightweight organizational branching over Diagram Versions
// (core/project.js's `versions` array — each entry already carries a
// `branch` field, defaulting to 'main'). Deliberately NOT a real git-style
// branch/merge model: there is no well-defined automatic way to reconcile
// two diverged diagrams' node positions/edges without a genuine conflict-
// resolution UI (a real architecture project of its own), so "merge" here
// is an explicit, honest "copy one version's whole content onto another
// branch as a new version" — the same primitive both "create a branch
// from here" and "merge into..." are built from. Pure/DOM-free.
import { nextId } from './id.js';

export const DEFAULT_BRANCH = 'main';

export function normalizeBranchName(name) {
  return (name || '').trim() || DEFAULT_BRANCH;
}

/** Every distinct branch name among `versions`, with 'main' always first —
 * a project conceptually always has a main line, even before any version
 * has been explicitly branched off it. */
export function listBranches(versions) {
  const others = new Set();
  for (const v of versions) {
    const branch = v.branch || DEFAULT_BRANCH;
    if (branch !== DEFAULT_BRANCH) others.add(branch);
  }
  return [DEFAULT_BRANCH, ...Array.from(others).sort()];
}

export function versionsOnBranch(versions, branch) {
  const target = normalizeBranchName(branch);
  return versions.filter((v) => (v.branch || DEFAULT_BRANCH) === target);
}

/**
 * Copies an existing version's content as a brand-new version on a
 * (possibly different) branch. Used for both "create a branch from this
 * version" (targetBranch = a new name) and "merge into..." (targetBranch =
 * an existing branch, landing this version's content as its newest entry —
 * the explicit "pick this side" choice, not an automatic merge).
 */
export function copyVersionToBranch(version, targetBranch, name) {
  const branch = normalizeBranchName(targetBranch);
  return {
    id: nextId('ver'),
    name: (name || '').trim() || `${version.name} (${branch})`,
    createdAt: new Date().toISOString(),
    branch,
    snapshot: structuredClone(version.snapshot),
  };
}
