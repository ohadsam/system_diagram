// Shared "name (imported)" / "name (imported 2)" suffixing used by every
// merge-style import (custom components, saved projects) so a name
// collision with a different id never silently overwrites or duplicates.
export function disambiguateName(name, namesInUse) {
  if (!namesInUse.has(name)) return name;
  let candidate = `${name} (imported)`;
  let n = 2;
  while (namesInUse.has(candidate)) {
    candidate = `${name} (imported ${n})`;
    n += 1;
  }
  return candidate;
}
