import { c } from '../schema.js';

export const category = { id: 'devops', label: 'DevOps & CI/CD', color: '#EA580C' };

const DO = '#EA580C';

export const components = [
  c('devops-ansible', 'Ansible', '🔴', { color: '#EE0000' }),
  c('devops-argocd', 'ArgoCD', '🐙', { color: '#EF7B4D' }),
  c('devops-azure-devops', 'Azure DevOps', '🔷', { color: '#0078D7' }),
  c('devops-bamboo', 'Bamboo', '🎋', { color: '#0052CC' }),
  c('devops-chef', 'Chef', '👨‍🍳', { color: DO }),
  c('devops-circleci', 'CircleCI', '⭕', { color: '#343434' }),
  c('devops-github-actions', 'GitHub Actions', '🐙', { color: '#24292E' }),
  c('devops-gitlab-ci', 'GitLab CI', '🦊', { color: '#FC6D26' }),
  c('devops-jenkins', 'Jenkins', '🎩', { color: '#D24939' }),
  c('devops-puppet', 'Puppet', '🎎', { color: '#FFAE1A' }),
  c('devops-spinnaker', 'Spinnaker', '❄️', { color: '#139BB4' }),
  c('devops-teamcity', 'TeamCity', '🚦', { color: '#000000' }),
  c('devops-terraform', 'Terraform', '🌍', { color: '#7B42BC' }),
  c('devops-travisci', 'Travis CI', '🐫', { color: '#3EAAAF' }),
];
