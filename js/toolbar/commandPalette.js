// Pure matching logic for the Command Palette (Ctrl/Cmd+K) — see
// modals/commandPaletteModal.js for the actual command list/UI, which
// needs live imports (open a modal, dispatch a store action, ...) and so
// isn't itself pure. Kept separate purely so this one small, genuinely
// reusable piece stays unit-testable without a DOM.
export function filterCommands(commands, query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return commands;
  return commands.filter((c) => c.label.toLowerCase().includes(q) || (c.keywords || []).some((k) => k.toLowerCase().includes(q)));
}
