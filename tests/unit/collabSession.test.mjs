import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../js/core/store.js';
import { createEmptyProject, createNode } from '../../js/core/project.js';
import { startCollabSession } from '../../js/collab/collabSession.js';

function fakeTransport() {
  const messageHandlers = new Set();
  return {
    sent: [],
    send(data) { this.sent.push(data); },
    onMessage(fn) { messageHandlers.add(fn); return () => messageHandlers.delete(fn); },
    receive(data) { for (const fn of messageHandlers) fn(data); },
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
  store.loadProject(createEmptyProject('Test'));
});

test('a local edit is broadcast (debounced) as a whole-project state message', async () => {
  const transport = fakeTransport();
  const session = startCollabSession(transport);

  store.dispatch((draft) => { draft.nodes.push(createNode({ id: 'def-x' }, 10, 10)); });
  assert.equal(transport.sent.length, 0, 'not sent yet — still inside the debounce window');

  await wait(500);
  assert.equal(transport.sent.length, 1);
  assert.equal(transport.sent[0].type, 'state');
  assert.equal(transport.sent[0].project.nodes.length, 1);

  session.stop();
});

test('a burst of rapid local edits collapses into a single broadcast', async () => {
  const transport = fakeTransport();
  const session = startCollabSession(transport);

  for (let i = 0; i < 5; i++) {
    store.dispatch((draft) => { draft.nodes.push(createNode({ id: 'def-x' }, i, i)); });
  }
  await wait(500);
  assert.equal(transport.sent.length, 1, 'only the settled result should be sent, not one message per edit');
  assert.equal(transport.sent[0].project.nodes.length, 5);

  session.stop();
});

test('an incoming remote state message is applied to the local store', async () => {
  const transport = fakeTransport();
  const session = startCollabSession(transport);

  const remoteProject = { ...createEmptyProject('From peer'), nodes: [createNode({ id: 'def-y' }, 0, 0)] };
  transport.receive({ type: 'state', project: remoteProject });

  assert.equal(store.getState().nodes.length, 1);
  assert.equal(store.getState().name, 'From peer');

  session.stop();
});

test('applying a remote state message does not re-broadcast it back out (no echo loop)', async () => {
  const transport = fakeTransport();
  const session = startCollabSession(transport);

  const remoteProject = { ...createEmptyProject('From peer'), nodes: [createNode({ id: 'def-y' }, 0, 0)] };
  transport.receive({ type: 'state', project: remoteProject });

  await wait(500);
  assert.equal(transport.sent.length, 0, 'applying a remote update must not trigger our own change listener to re-send it');

  session.stop();
});

test('malformed or irrelevant incoming messages are ignored without throwing', () => {
  const transport = fakeTransport();
  const session = startCollabSession(transport);

  assert.doesNotThrow(() => transport.receive(null));
  assert.doesNotThrow(() => transport.receive({}));
  assert.doesNotThrow(() => transport.receive({ type: 'ping' }));
  assert.doesNotThrow(() => transport.receive({ type: 'state', project: null }));
  assert.equal(store.getState().nodes.length, 0);

  session.stop();
});

test('sendInitialState immediately sends the current project without waiting for the debounce', () => {
  const transport = fakeTransport();
  const session = startCollabSession(transport);
  store.dispatch((draft) => { draft.nodes.push(createNode({ id: 'def-x' }, 0, 0)); }, { coalesce: true });

  session.sendInitialState();
  assert.equal(transport.sent.length, 1);
  assert.equal(transport.sent[0].type, 'state');

  session.stop();
});

test('stop() unsubscribes — further local edits and incoming messages are both ignored', async () => {
  const transport = fakeTransport();
  const session = startCollabSession(transport);
  session.stop();

  store.dispatch((draft) => { draft.nodes.push(createNode({ id: 'def-x' }, 0, 0)); });
  await wait(500);
  assert.equal(transport.sent.length, 0);

  const before = store.getState().nodes.length;
  transport.receive({ type: 'state', project: { ...createEmptyProject(), nodes: [createNode({ id: 'def-y' }, 0, 0), createNode({ id: 'def-y' }, 1, 1)] } });
  assert.equal(store.getState().nodes.length, before, 'a message after stop() should not be applied');
});
