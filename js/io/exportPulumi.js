// Best-effort Pulumi (TypeScript) export for AWS-heavy diagrams — a sibling
// of io/exportTerraform.js, same shape and same curation bar (see that
// file's header comment): only the most common AWS building blocks are
// mapped, using the exact same defId set as AWS_RESOURCE_MAP since
// @pulumi/aws and the Terraform AWS provider cover essentially the same
// resource surface by design. An AWS component with no curated mapping is
// listed in a trailing comment rather than silently dropped; a non-AWS
// component is skipped without comment. Pure, DOM-free.
const AWS_PULUMI_MAP = {
  'aws-ec2': { module: 'ec2', cls: 'Instance' },
  'aws-s3': { module: 's3', cls: 'Bucket' },
  'aws-rds': { module: 'rds', cls: 'Instance' },
  'aws-aurora': { module: 'rds', cls: 'Cluster' },
  'aws-dynamodb': { module: 'dynamodb', cls: 'Table' },
  'aws-lambda': { module: 'lambda', cls: 'Function' },
  'aws-vpc': { module: 'ec2', cls: 'Vpc' },
  'aws-elb': { module: 'lb', cls: 'LoadBalancer' },
  'aws-api-gateway': { module: 'apigatewayv2', cls: 'Api' },
  'aws-ecs-cluster': { module: 'ecs', cls: 'Cluster' },
  'aws-ecs-service': { module: 'ecs', cls: 'Service' },
  'aws-eks-cluster': { module: 'eks', cls: 'Cluster' },
  'aws-sqs': { module: 'sqs', cls: 'Queue' },
  'aws-sns': { module: 'sns', cls: 'Topic' },
  'aws-cloudfront': { module: 'cloudfront', cls: 'Distribution' },
  'aws-route53': { module: 'route53', cls: 'Zone' },
  'aws-elasticache': { module: 'elasticache', cls: 'Cluster' },
  'aws-redshift': { module: 'redshift', cls: 'Cluster' },
  'aws-iam': { module: 'iam', cls: 'Role' },
  'aws-kms': { module: 'kms', cls: 'Key' },
  'aws-secrets-manager': { module: 'secretsmanager', cls: 'Secret' },
  'aws-step-functions': { module: 'sfn', cls: 'StateMachine' },
  'aws-eventbridge': { module: 'cloudwatch', cls: 'EventBus' },
  'aws-kinesis': { module: 'kinesis', cls: 'Stream' },
  'aws-ecr': { module: 'ecr', cls: 'Repository' },
  'aws-nat-gateway': { module: 'ec2', cls: 'NatGateway' },
  'aws-internet-gateway': { module: 'ec2', cls: 'InternetGateway' },
  'aws-auto-scaling': { module: 'autoscaling', cls: 'Group' },
  'aws-waf': { module: 'wafv2', cls: 'WebAcl' },
  'aws-cognito': { module: 'cognito', cls: 'UserPool' },
  'aws-glue': { module: 'glue', cls: 'Job' },
  'aws-documentdb': { module: 'docdb', cls: 'Cluster' },
  'aws-neptune': { module: 'neptune', cls: 'Cluster' },
  'aws-efs': { module: 'efs', cls: 'FileSystem' },
  'aws-ebs': { module: 'ebs', cls: 'Volume' },
  'aws-transit-gateway': { module: 'ec2transitgateway', cls: 'TransitGateway' },
  'aws-app-runner': { module: 'apprunner', cls: 'Service' },
  'aws-batch': { module: 'batch', cls: 'JobQueue' },
};

function toVarName(text, fallback) {
  const cleaned = (text || '').replace(/[^a-zA-Z0-9]+/g, ' ').trim()
    .split(' ').filter(Boolean)
    .map((word, i) => (i === 0 ? word.toLowerCase() : word[0].toUpperCase() + word.slice(1).toLowerCase()))
    .join('');
  return cleaned || fallback;
}

function escapeTs(text) {
  return (text || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * @param {object[]} nodes
 * @param {object[]} edges
 * @returns {string} an index.ts-shaped Pulumi program skeleton — real syntax, placeholder args
 */
export function buildPulumi(nodes, edges) {
  const usedNames = new Set();
  const unmapped = [];
  const resourceLines = [];

  for (const node of nodes) {
    if (!node.defId?.startsWith('aws-')) continue;
    const mapping = AWS_PULUMI_MAP[node.defId];
    if (!mapping) {
      unmapped.push(node.text || node.defId);
      continue;
    }
    let name = toVarName(node.text, node.id);
    let unique = name;
    for (let i = 2; usedNames.has(unique); i++) unique = `${name}${i}`;
    usedNames.add(unique);

    resourceLines.push(`const ${unique} = new aws.${mapping.module}.${mapping.cls}("${escapeTs(node.text || unique)}", {`);
    resourceLines.push('  // TODO: fill in required arguments for this resource');
    resourceLines.push(`  tags: { Name: "${escapeTs(node.text)}" },`);
    resourceLines.push('});');
    resourceLines.push('');
  }

  const lines = [
    '// Auto-generated from a System Design Diagram Builder diagram.',
    '// Best-effort skeleton only — fill in required arguments before `pulumi up`.',
    'import * as pulumi from "@pulumi/pulumi";',
    'import * as aws from "@pulumi/aws";',
    '',
    ...resourceLines,
  ];

  const relevantEdges = edges.filter((e) => {
    const from = nodes.find((n) => n.id === e.from);
    const to = nodes.find((n) => n.id === e.to);
    return from?.defId?.startsWith('aws-') && to?.defId?.startsWith('aws-');
  });
  if (relevantEdges.length) {
    const byId = new Map(nodes.map((n) => [n.id, n.text || n.id]));
    lines.push('// Connectors between AWS components on the canvas (not auto-wired into');
    lines.push('// resource references — connect the relevant outputs/inputs by hand):');
    for (const e of relevantEdges) lines.push(`//   ${byId.get(e.from)} -> ${byId.get(e.to)}`);
    lines.push('');
  }

  if (unmapped.length) {
    lines.push('// AWS components with no curated Pulumi mapping yet (not exported as resources):');
    for (const name of unmapped) lines.push(`//   - ${name}`);
    lines.push('');
  }

  return lines.join('\n');
}
