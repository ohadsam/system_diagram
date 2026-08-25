import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTerraform } from '../../js/io/exportTerraform.js';

test('buildTerraform: emits a provider block even with no nodes', () => {
  const tf = buildTerraform([], []);
  assert.match(tf, /provider "aws"/);
  assert.match(tf, /required_providers/);
});

test('buildTerraform: a mapped AWS component becomes a real resource block', () => {
  const nodes = [{ id: 'n1', defId: 'aws-s3', text: 'Uploads Bucket' }];
  const tf = buildTerraform(nodes, []);
  assert.match(tf, /resource "aws_s3_bucket" "uploads_bucket" \{/);
  assert.match(tf, /Name = "Uploads Bucket"/);
});

test('buildTerraform: non-AWS components are skipped without comment', () => {
  const nodes = [{ id: 'n1', defId: 'shape-client', text: 'Browser' }];
  const tf = buildTerraform(nodes, []);
  assert.doesNotMatch(tf, /Browser/);
});

test('buildTerraform: an AWS component with no curated mapping is listed, not dropped', () => {
  const nodes = [{ id: 'n1', defId: 'aws-lex', text: 'Chatbot' }];
  const tf = buildTerraform(nodes, []);
  assert.doesNotMatch(tf, /resource "/);
  assert.match(tf, /no curated Terraform mapping/);
  assert.match(tf, /- Chatbot/);
});

test('buildTerraform: two components with the same name get disambiguated resource names', () => {
  const nodes = [
    { id: 'n1', defId: 'aws-ec2', text: 'Server' },
    { id: 'n2', defId: 'aws-ec2', text: 'Server' },
  ];
  const tf = buildTerraform(nodes, []);
  assert.match(tf, /resource "aws_instance" "server" \{/);
  assert.match(tf, /resource "aws_instance" "server_2" \{/);
});

test('buildTerraform: connectors between two mapped AWS components are listed as a comment', () => {
  const nodes = [
    { id: 'n1', defId: 'aws-api-gateway', text: 'API Gateway' },
    { id: 'n2', defId: 'aws-lambda', text: 'Handler' },
  ];
  const edges = [{ id: 'e1', from: 'n1', to: 'n2' }];
  const tf = buildTerraform(nodes, edges);
  assert.match(tf, /#\s+API Gateway -> Handler/);
});

test('buildTerraform: a connector touching a non-AWS component is not listed', () => {
  const nodes = [
    { id: 'n1', defId: 'shape-client', text: 'Browser' },
    { id: 'n2', defId: 'aws-lambda', text: 'Handler' },
  ];
  const edges = [{ id: 'e1', from: 'n1', to: 'n2' }];
  const tf = buildTerraform(nodes, edges);
  assert.doesNotMatch(tf, /Connectors between AWS/);
});
