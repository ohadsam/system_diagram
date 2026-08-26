import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSqlDdl } from '../../js/io/sqlDdlImport.js';

test('returns ok:false with a message when no CREATE TABLE is found', () => {
  const result = parseSqlDdl('SELECT * FROM users;');
  assert.equal(result.ok, false);
  assert.match(result.error, /No CREATE TABLE/i);
});

test('parses a simple table with columns and a primary key', () => {
  const result = parseSqlDdl(`
    CREATE TABLE users (
      id INT PRIMARY KEY,
      email VARCHAR(255)
    );
  `);
  assert.equal(result.ok, true);
  assert.equal(result.tables.length, 1);
  const users = result.tables[0];
  assert.equal(users.name, 'users');
  assert.equal(users.columns.length, 2);
  assert.deepEqual(users.columns[0], { name: 'id', type: 'INT', isPrimaryKey: true });
  assert.equal(users.columns[1].name, 'email');
  assert.equal(users.columns[1].isPrimaryKey, false);
});

test('parses an inline REFERENCES foreign key', () => {
  const result = parseSqlDdl(`
    CREATE TABLE users (id INT PRIMARY KEY);
    CREATE TABLE orders (
      id INT PRIMARY KEY,
      user_id INT REFERENCES users(id)
    );
  `);
  assert.equal(result.ok, true);
  assert.equal(result.tables.length, 2);
  assert.equal(result.foreignKeys.length, 1);
  assert.deepEqual(result.foreignKeys[0], { fromTable: 'orders', fromColumn: 'user_id', toTable: 'users', toColumn: 'id' });
});

test('parses a table-level FOREIGN KEY(...) REFERENCES ...(...) constraint', () => {
  const result = parseSqlDdl(`
    CREATE TABLE users (id INT PRIMARY KEY);
    CREATE TABLE orders (
      id INT PRIMARY KEY,
      user_id INT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  assert.equal(result.foreignKeys.length, 1);
  assert.deepEqual(result.foreignKeys[0], { fromTable: 'orders', fromColumn: 'user_id', toTable: 'users', toColumn: 'id' });
});

test('does not split a column type\'s own parens (e.g. DECIMAL(10,2)) as separate columns', () => {
  const result = parseSqlDdl('CREATE TABLE payments (id INT PRIMARY KEY, amount DECIMAL(10,2));');
  assert.equal(result.tables[0].columns.length, 2);
  assert.equal(result.tables[0].columns[1].name, 'amount');
  assert.equal(result.tables[0].columns[1].type, 'DECIMAL(10,2)');
});

test('strips backticks/double-quotes from identifiers', () => {
  const result = parseSqlDdl('CREATE TABLE `users` (`id` INT PRIMARY KEY);');
  assert.equal(result.tables[0].name, 'users');
  assert.equal(result.tables[0].columns[0].name, 'id');
});

test('ignores line and block comments', () => {
  const result = parseSqlDdl(`
    -- a comment
    /* block
       comment */
    CREATE TABLE users (id INT PRIMARY KEY);
  `);
  assert.equal(result.ok, true);
  assert.equal(result.tables.length, 1);
});

test('drops a foreign key referencing a table that was never actually defined', () => {
  const result = parseSqlDdl('CREATE TABLE orders (id INT PRIMARY KEY, user_id INT REFERENCES ghost_table(id));');
  assert.equal(result.foreignKeys.length, 0);
});

test('a table with only table-level constraints and no real columns is skipped', () => {
  const result = parseSqlDdl(`
    CREATE TABLE a (id INT PRIMARY KEY);
    CREATE TABLE b (id INT PRIMARY KEY);
    CREATE TABLE link_table (
      FOREIGN KEY (a_id) REFERENCES a(id),
      FOREIGN KEY (b_id) REFERENCES b(id)
    );
  `);
  assert.equal(result.tables.some((t) => t.name === 'link_table'), false);
});

test('handles empty/missing input without throwing', () => {
  assert.equal(parseSqlDdl('').ok, false);
  assert.equal(parseSqlDdl(undefined).ok, false);
});
