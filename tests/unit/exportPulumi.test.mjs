import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPulumi } from '../../js/io/exportPulumi.js';

test('buildPulumi: emits the standard imports even with no nodes', () => {
  const ts = buildPulumi([], []);
  assert.match(ts, /import \* as aws from "@pulumi\/aws";/);
});

test('buildPulumi: a mapped AWS component becomes a real resource declaration', () => {
  const nodes = [{ id: 'n1', defId: 'aws-s3', text: 'Uploads Bucket' }];
  const ts = buildPulumi(nodes, []);
  assert.match(ts, /const uploadsBucket = new aws\.s3\.Bucket\("Uploads Bucket", \{/);
});

test('buildPulumi: non-AWS components are skipped without comment', () => {
  const nodes = [{ id: 'n1', defId: 'shape-client', text: 'Browser' }];
  const ts = buildPulumi(nodes, []);
  assert.doesNotMatch(ts, /Browser/);
});

test('buildPulumi: an AWS component with no curated mapping is listed, not dropped', () => {
  const nodes = [{ id: 'n1', defId: 'aws-lex', text: 'Chatbot' }];
  const ts = buildPulumi(nodes, []);
  assert.doesNotMatch(ts, /new aws\./);
  assert.match(ts, /no curated Pulumi mapping/);
  assert.match(ts, /- Chatbot/);
});

test('buildPulumi: two components with the same name get disambiguated variable names', () => {
  const nodes = [
    { id: 'n1', defId: 'aws-ec2', text: 'Server' },
    { id: 'n2', defId: 'aws-ec2', text: 'Server' },
  ];
  const ts = buildPulumi(nodes, []);
  assert.match(ts, /const server = new aws\.ec2\.Instance/);
  assert.match(ts, /const server2 = new aws\.ec2\.Instance/);
});

test('buildPulumi: connectors between two mapped AWS components are listed as a comment', () => {
  const nodes = [
    { id: 'n1', defId: 'aws-api-gateway', text: 'API Gateway' },
    { id: 'n2', defId: 'aws-lambda', text: 'Handler' },
  ];
  const edges = [{ id: 'e1', from: 'n1', to: 'n2' }];
  const ts = buildPulumi(nodes, edges);
  assert.match(ts, /\/\/\s+API Gateway -> Handler/);
});
