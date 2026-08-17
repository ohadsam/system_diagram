import { c } from '../schema.js';

export const category = { id: 'ai-ml', label: 'AI / ML', color: '#8B5CF6' };

const AI = '#8B5CF6';

export const components = [
  c('ai-embedding-model', 'Embedding Model', '🧬', { color: AI, related: ['ai-vector-db'] }),
  c('ai-feature-store', 'Feature Store', '🗃️', { shape: 'cylinder', color: AI }),
  c('ai-inference-endpoint', 'Inference Endpoint', '🎯', { color: AI, related: ['ai-model-registry'] }),
  c('ai-jupyter', 'Jupyter Notebook', '📓', { color: '#F37626' }),
  c('ai-langchain', 'LangChain', '🔗', { color: AI, related: ['ai-llm', 'ai-vector-db'] }),
  c('ai-llm', 'LLM (Large Language Model)', '🧠', { color: AI, related: ['ai-prompt-cache', 'ai-inference-endpoint'] }),
  c('ai-mlflow', 'MLflow', '🌊', { color: '#0194E2', related: ['ai-training-pipeline', 'ai-model-registry'] }),
  c('ai-model-registry', 'Model Registry', '📚', { shape: 'cylinder', color: AI, related: ['ai-training-pipeline', 'ai-inference-endpoint'] }),
  c('ai-prompt-cache', 'Prompt / Response Cache', '💾', { shape: 'cylinder', color: AI }),
  c('ai-pytorch', 'PyTorch', '🔥', { color: '#EE4C2C', related: ['ai-training-pipeline'] }),
  c('ai-tensorflow', 'TensorFlow', '🟠', { color: '#FF6F00', related: ['ai-training-pipeline'] }),
  c('ai-training-pipeline', 'Training Pipeline', '🏋️', { color: AI, related: ['ai-model-registry', 'ai-feature-store'] }),
  c('ai-vector-db', 'Vector Database', '🧭', { shape: 'cylinder', color: AI, related: ['ai-embedding-model'] }),
];
