import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCostOptimizePrompt } from '../../js/io/aiCostOptimize.js';

test('buildCostOptimizePrompt lists every costed component and the total', () => {
  const costedNodes = [
    { text: 'API Gateway', monthlyCost: 25 },
    { text: 'Database', monthlyCost: 75 },
  ];
  const prompt = buildCostOptimizePrompt({ costedNodes, total: 100 });
  assert.match(prompt, /API Gateway: \$25/);
  assert.match(prompt, /Database: \$75/);
  assert.match(prompt, /Total: \$100/);
  assert.match(prompt, /reduce this cost/i);
});
