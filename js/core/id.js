// Small dependency-free unique id generator (not cryptographically secure —
// used only for local object identity, never for anything security-sensitive).
let counter = 0;

export function nextId(prefix = 'id') {
  counter += 1;
  const random = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36);
  return `${prefix}_${time}${random}${counter.toString(36)}`;
}

export function resetIdCounterForTests() {
  counter = 0;
}
