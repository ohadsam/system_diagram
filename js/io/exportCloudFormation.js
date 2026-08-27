// Best-effort AWS CloudFormation (YAML) export — a sibling of
// io/exportTerraform.js/exportPulumi.js, same shape and curation bar (see
// exportTerraform.js's header comment): only common AWS building blocks are
// mapped; anything else is listed in a trailing comment instead of being
// silently dropped. Pure, DOM-free.
const AWS_CFN_TYPE_MAP = {
  'aws-ec2': 'AWS::EC2::Instance',
  'aws-s3': 'AWS::S3::Bucket',
  'aws-rds': 'AWS::RDS::DBInstance',
  'aws-aurora': 'AWS::RDS::DBCluster',
  'aws-dynamodb': 'AWS::DynamoDB::Table',
  'aws-lambda': 'AWS::Lambda::Function',
  'aws-vpc': 'AWS::EC2::VPC',
  'aws-elb': 'AWS::ElasticLoadBalancingV2::LoadBalancer',
  'aws-api-gateway': 'AWS::ApiGatewayV2::Api',
  'aws-ecs-cluster': 'AWS::ECS::Cluster',
  'aws-ecs-service': 'AWS::ECS::Service',
  'aws-eks-cluster': 'AWS::EKS::Cluster',
  'aws-sqs': 'AWS::SQS::Queue',
  'aws-sns': 'AWS::SNS::Topic',
  'aws-cloudfront': 'AWS::CloudFront::Distribution',
  'aws-route53': 'AWS::Route53::HostedZone',
  'aws-elasticache': 'AWS::ElastiCache::CacheCluster',
  'aws-redshift': 'AWS::Redshift::Cluster',
  'aws-iam': 'AWS::IAM::Role',
  'aws-kms': 'AWS::KMS::Key',
  'aws-secrets-manager': 'AWS::SecretsManager::Secret',
  'aws-step-functions': 'AWS::StepFunctions::StateMachine',
  'aws-eventbridge': 'AWS::Events::EventBus',
  'aws-kinesis': 'AWS::Kinesis::Stream',
  'aws-ecr': 'AWS::ECR::Repository',
  'aws-nat-gateway': 'AWS::EC2::NatGateway',
  'aws-internet-gateway': 'AWS::EC2::InternetGateway',
  'aws-auto-scaling': 'AWS::AutoScaling::AutoScalingGroup',
  'aws-waf': 'AWS::WAFv2::WebACL',
  'aws-cognito': 'AWS::Cognito::UserPool',
  'aws-glue': 'AWS::Glue::Job',
  'aws-documentdb': 'AWS::DocDB::DBCluster',
  'aws-neptune': 'AWS::Neptune::DBCluster',
  'aws-efs': 'AWS::EFS::FileSystem',
  'aws-transit-gateway': 'AWS::EC2::TransitGateway',
  'aws-app-runner': 'AWS::AppRunner::Service',
  'aws-batch': 'AWS::Batch::JobQueue',
};

function toLogicalId(text, fallback) {
  const cleaned = (text || '').replace(/[^a-zA-Z0-9]+/g, ' ').trim()
    .split(' ').filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join('');
  return cleaned || fallback;
}

function yamlQuote(text) {
  return `"${(text || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * @param {object[]} nodes
 * @param {object[]} edges
 * @returns {string} a .yaml-shaped CloudFormation template skeleton — real syntax, placeholder properties
 */
export function buildCloudFormation(nodes, edges) {
  const lines = [
    '# Auto-generated from a System Design Diagram Builder diagram.',
    '# Best-effort skeleton only — fill in required Properties before deploying.',
    'AWSTemplateFormatVersion: "2010-09-09"',
    'Description: Generated from a System Design Diagram Builder diagram.',
    '',
    'Resources:',
  ];

  const usedIds = new Set();
  const unmapped = [];
  let wroteAny = false;
  for (const node of nodes) {
    if (!node.defId?.startsWith('aws-')) continue;
    const type = AWS_CFN_TYPE_MAP[node.defId];
    if (!type) {
      unmapped.push(node.text || node.defId);
      continue;
    }
    let id = toLogicalId(node.text, node.id.replace(/[^a-zA-Z0-9]/g, ''));
    let unique = id;
    for (let i = 2; usedIds.has(unique); i++) unique = `${id}${i}`;
    usedIds.add(unique);
    wroteAny = true;

    lines.push(`  ${unique}:`);
    lines.push(`    Type: ${type}`);
    lines.push('    Properties: {} # TODO: fill in required properties for this resource');
    lines.push(`    # Name on the diagram: ${yamlQuote(node.text)}`);
  }
  if (!wroteAny) lines.push('  {} # no mapped AWS components on this diagram yet');
  lines.push('');

  const relevantEdges = edges.filter((e) => {
    const from = nodes.find((n) => n.id === e.from);
    const to = nodes.find((n) => n.id === e.to);
    return from?.defId?.startsWith('aws-') && to?.defId?.startsWith('aws-');
  });
  if (relevantEdges.length) {
    const byId = new Map(nodes.map((n) => [n.id, n.text || n.id]));
    lines.push('# Connectors between AWS components on the canvas (not auto-wired into');
    lines.push('# Ref/GetAtt properties — connect the relevant resources by hand):');
    for (const e of relevantEdges) lines.push(`#   ${byId.get(e.from)} -> ${byId.get(e.to)}`);
    lines.push('');
  }

  if (unmapped.length) {
    lines.push('# AWS components with no curated CloudFormation mapping yet (not exported as resources):');
    for (const name of unmapped) lines.push(`#   - ${name}`);
    lines.push('');
  }

  return lines.join('\n');
}
