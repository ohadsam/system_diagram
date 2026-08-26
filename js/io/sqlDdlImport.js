// Parses `CREATE TABLE` SQL DDL into tables + foreign keys for
// canvas.js#createErDiagramFromDdl to lay out as an ER diagram (reusing the
// `rows`-shape "entity" convention design-patterns.js's own ER templates
// already established — see its `entity()` helper). Regex/paren-depth
// based rather than a real SQL grammar, same "best effort, not a
// guaranteed round-trip" spirit as this app's Mermaid/PlantUML import —
// good enough for the CREATE TABLE styles MySQL/Postgres/SQL Server/SQLite
// actually emit, not a general-purpose SQL parser.
function stripSqlComments(text) {
  return text.replace(/--[^\n]*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function cleanIdent(raw) {
  return (raw || '').trim().replace(/^[`"[]|[`"\]]$/g, '');
}

function splitIdentList(raw) {
  return raw.split(',').map((s) => cleanIdent(s.trim())).filter(Boolean);
}

/** Splits `str` on `sep`, but only where paren depth is 0 — a plain
 * String#split would incorrectly split inside `DECIMAL(10,2)` or
 * `FOREIGN KEY (a, b)`. */
function splitTopLevel(str, sep) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of str) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === sep && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

/** `text[openParenIndex]` must be '(' — returns the text strictly between
 * it and its matching ')', or null if unbalanced. */
function extractBalancedParens(text, openParenIndex) {
  if (text[openParenIndex] !== '(') return null;
  let depth = 0;
  for (let i = openParenIndex; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') {
      depth -= 1;
      if (depth === 0) return text.slice(openParenIndex + 1, i);
    }
  }
  return null;
}

function parseColumnDef(def) {
  const m = def.match(/^[`"[]?(\w+)[`"\]]?\s+([\s\S]+)$/);
  if (!m) return null;
  const name = m[1];
  const rest = m[2];
  const typeMatch = rest.match(/^(\w+(?:\s*\([^)]*\))?)/);
  const type = typeMatch ? typeMatch[1].replace(/\s+/g, '') : '';
  const isPrimaryKey = /PRIMARY\s+KEY/i.test(rest);
  let inlineFk = null;
  const refMatch = rest.match(/REFERENCES\s+[`"[]?([\w.]+)[`"\]]?\s*\(([^)]+)\)/i);
  if (refMatch) {
    inlineFk = { toTable: cleanIdent(refMatch[1].split('.').pop()), toColumn: splitIdentList(refMatch[2])[0] };
  }
  return { name, type, isPrimaryKey, inlineFk };
}

/**
 * @param {string} sqlText
 * @returns {{ok: true, tables: {name: string, columns: {name: string, type: string, isPrimaryKey: boolean}[]}[], foreignKeys: {fromTable: string, fromColumn: string, toTable: string, toColumn: string}[]} | {ok: false, error: string}}
 */
export function parseSqlDdl(sqlText) {
  const text = stripSqlComments(sqlText || '');
  const tables = [];
  const foreignKeys = [];
  const tableRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"[\]\w.]+)\s*\(/gi;
  let match;
  while ((match = tableRe.exec(text))) {
    const tableName = cleanIdent(match[1].split('.').pop());
    const openParenIndex = match.index + match[0].length - 1;
    const body = extractBalancedParens(text, openParenIndex);
    if (body == null) continue;

    const columns = [];
    for (const rawDef of splitTopLevel(body, ',')) {
      const def = rawDef.trim();
      if (!def) continue;
      const upper = def.toUpperCase();

      if (/^(FOREIGN\s+KEY|CONSTRAINT\b[\s\S]*FOREIGN\s+KEY)/.test(upper)) {
        const fkMatch = def.match(/FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+([`"[\]\w.]+)\s*\(([^)]+)\)/i);
        if (fkMatch) {
          const fromCols = splitIdentList(fkMatch[1]);
          const toCols = splitIdentList(fkMatch[3]);
          const toTable = cleanIdent(fkMatch[2].split('.').pop());
          fromCols.forEach((fromCol, i) => {
            foreignKeys.push({ fromTable: tableName, fromColumn: fromCol, toTable, toColumn: toCols[i] || toCols[0] });
          });
        }
        continue;
      }
      if (/^(PRIMARY\s+KEY|UNIQUE|CHECK|INDEX|KEY)\b/.test(upper)) continue; // a table-level constraint, not a column

      const col = parseColumnDef(def);
      if (!col) continue;
      columns.push({ name: col.name, type: col.type, isPrimaryKey: col.isPrimaryKey });
      if (col.inlineFk) {
        foreignKeys.push({ fromTable: tableName, fromColumn: col.name, toTable: col.inlineFk.toTable, toColumn: col.inlineFk.toColumn });
      }
    }
    if (columns.length) tables.push({ name: tableName, columns });
  }

  if (!tables.length) return { ok: false, error: 'No CREATE TABLE statements found.' };

  const tableNames = new Set(tables.map((t) => t.name));
  const validForeignKeys = foreignKeys.filter((fk) => tableNames.has(fk.fromTable) && tableNames.has(fk.toTable));
  return { ok: true, tables, foreignKeys: validForeignKeys };
}
