import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCloudFormation } from '../../js/io/exportCloudFormation.js';

test('buildCloudFormation: emits the template header even with no nodes', () => {
  const yaml = buildCloudFormation([], []);
  assert.match(yaml, /AWSTemplateFormatVersion: "2010-09-09"/);
  assert.match(yaml, /Resources:/);
});

test('buildCloudFormation: a mapped AWS component becomes a real resource block', () => {
  const nodes = [{ id: 'n1', defId: 'aws-s3', text: 'Uploads Bucket' }];
  const yaml = buildCloudFormation(nodes, []);
  assert.match(yaml, /UploadsBucket:\s*\n\s*Type: AWS::S3::Bucket/);
});

test('buildCloudFormation: non-AWS components are skipped without comment', () => {
  const nodes = [{ id: 'n1', defId: 'shape-client', text: 'Browser' }];
  const yaml = buildCloudFormation(nodes, []);
  assert.doesNotMatch(yaml, /Browser/);
});

test('buildCloudFormation: an AWS component with no curated mapping is listed, not dropped', () => {
  const nodes = [{ id: 'n1', defId: 'aws-lex', text: 'Chatbot' }];
  const yaml = buildCloudFormation(nodes, []);
  assert.doesNotMatch(yaml, /Type: AWS::/);
  assert.match(yaml, /no curated CloudFormation mapping/);
  assert.match(yaml, /- Chatbot/);
});

test('buildCloudFormation: two components with the same name get disambiguated logical ids', () => {
  const nodes = [
    { id: 'n1', defId: 'aws-ec2', text: 'Server' },
    { id: 'n2', defId: 'aws-ec2', text: 'Server' },
  ];
  const yaml = buildCloudFormation(nodes, []);
  assert.match(yaml, /  Server:\n/);
  assert.match(yaml, /  Server2:\n/);
});

test('buildCloudFormation: connectors between two mapped AWS components are listed as a comment', () => {
  const nodes = [
    { id: 'n1', defId: 'aws-api-gateway', text: 'API Gateway' },
    { id: 'n2', defId: 'aws-lambda', text: 'Handler' },
  ];
  const edges = [{ id: 'e1', from: 'n1', to: 'n2' }];
  const yaml = buildCloudFormation(nodes, edges);
  assert.match(yaml, /#\s+API Gateway -> Handler/);
});
