// Best-effort Terraform (HCL) export for AWS-heavy diagrams — a sibling of
// io/exportDrawIO.js/exportFlowchartMermaid.js, same "pure text builder + a
// button in modals/exportDiagramModal.js" shape. Only maps the most common
// AWS building blocks to a real Terraform resource skeleton (same curation
// bar as Smart Suggestions — see the add-library-item skill: only pairings
// most engineers would immediately recognize, not exhaustive coverage of
// every AWS component in the library). An AWS component with no curated
// mapping is still listed by name in a trailing comment rather than
// silently dropped; a non-AWS component (a generic "Client" box, a
// database-agnostic shape, ...) has no Terraform equivalent to begin with
// and is skipped without comment. Pure, DOM-free.
const AWS_RESOURCE_MAP = {
  'aws-ec2': 'aws_instance',
  'aws-s3': 'aws_s3_bucket',
  'aws-rds': 'aws_db_instance',
  'aws-aurora': 'aws_rds_cluster',
  'aws-dynamodb': 'aws_dynamodb_table',
  'aws-lambda': 'aws_lambda_function',
  'aws-vpc': 'aws_vpc',
  'aws-elb': 'aws_lb',
  'aws-api-gateway': 'aws_apigatewayv2_api',
  'aws-ecs-cluster': 'aws_ecs_cluster',
  'aws-ecs-service': 'aws_ecs_service',
  'aws-eks-cluster': 'aws_eks_cluster',
  'aws-sqs': 'aws_sqs_queue',
  'aws-sns': 'aws_sns_topic',
  'aws-cloudfront': 'aws_cloudfront_distribution',
  'aws-route53': 'aws_route53_zone',
  'aws-elasticache': 'aws_elasticache_cluster',
  'aws-redshift': 'aws_redshift_cluster',
  'aws-iam': 'aws_iam_role',
  'aws-kms': 'aws_kms_key',
  'aws-secrets-manager': 'aws_secretsmanager_secret',
  'aws-step-functions': 'aws_sfn_state_machine',
  'aws-eventbridge': 'aws_cloudwatch_event_bus',
  'aws-kinesis': 'aws_kinesis_stream',
  'aws-ecr': 'aws_ecr_repository',
  'aws-nat-gateway': 'aws_nat_gateway',
  'aws-internet-gateway': 'aws_internet_gateway',
  'aws-auto-scaling': 'aws_autoscaling_group',
  'aws-waf': 'aws_wafv2_web_acl',
  'aws-cognito': 'aws_cognito_user_pool',
  'aws-glue': 'aws_glue_job',
  'aws-documentdb': 'aws_docdb_cluster',
  'aws-neptune': 'aws_neptune_cluster',
  'aws-efs': 'aws_efs_file_system',
  'aws-ebs': 'aws_ebs_volume',
  'aws-transit-gateway': 'aws_ec2_transit_gateway',
  'aws-app-runner': 'aws_apprunner_service',
  'aws-batch': 'aws_batch_job_queue',
};

function toResourceName(text, fallback) {
  const cleaned = (text || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

function escapeHcl(text) {
  return (text || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * @param {object[]} nodes
 * @param {object[]} edges
 * @returns {string} a .tf-file-shaped skeleton — real syntax, placeholder values
 */
export function buildTerraform(nodes, edges) {
  const lines = [
    '# Auto-generated from a System Design Diagram Builder diagram.',
    '# Best-effort skeleton only — fill in required arguments before `terraform apply`.',
    '',
    'terraform {',
    '  required_providers {',
    '    aws = {',
    '      source  = "hashicorp/aws"',
    '      version = "~> 5.0"',
    '    }',
    '  }',
    '}',
    '',
    'provider "aws" {',
    '  region = "us-east-1" # TODO: set your region',
    '}',
    '',
  ];

  const usedNames = new Set();
  const unmapped = [];
  for (const node of nodes) {
    if (!node.defId?.startsWith('aws-')) continue;
    const resourceType = AWS_RESOURCE_MAP[node.defId];
    if (!resourceType) {
      unmapped.push(node.text || node.defId);
      continue;
    }
    let name = toResourceName(node.text, node.id);
    let unique = name;
    for (let i = 2; usedNames.has(unique); i++) unique = `${name}_${i}`;
    usedNames.add(unique);

    lines.push(`resource "${resourceType}" "${unique}" {`);
    lines.push('  # TODO: fill in required arguments for this resource');
    lines.push('  tags = {');
    lines.push(`    Name = "${escapeHcl(node.text)}"`);
    lines.push('  }');
    lines.push('}');
    lines.push('');
  }

  const relevantEdges = edges.filter((e) => {
    const from = nodes.find((n) => n.id === e.from);
    const to = nodes.find((n) => n.id === e.to);
    return from?.defId?.startsWith('aws-') && to?.defId?.startsWith('aws-');
  });
  if (relevantEdges.length) {
    const byId = new Map(nodes.map((n) => [n.id, n.text || n.id]));
    lines.push('# Connectors between AWS components on the canvas (not auto-wired into');
    lines.push('# resource references — connect the relevant attributes/IDs by hand):');
    for (const e of relevantEdges) lines.push(`#   ${byId.get(e.from)} -> ${byId.get(e.to)}`);
    lines.push('');
  }

  if (unmapped.length) {
    lines.push('# AWS components with no curated Terraform mapping yet (not exported as resources):');
    for (const name of unmapped) lines.push(`#   - ${name}`);
    lines.push('');
  }

  return lines.join('\n');
}
