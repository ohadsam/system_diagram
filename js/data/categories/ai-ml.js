import { c } from '../schema.js';

export const category = { id: 'ai-ml', label: 'AI / ML', color: '#8B5CF6' };

const AI = '#8B5CF6';

export const components = [
  c('ai-embedding-model', 'Embedding Model', '🧬', { color: AI }),
  c('ai-feature-store', 'Feature Store', '🗃️', { shape: 'cylinder', color: AI }),
  c('ai-inference-endpoint', 'Inference Endpoint', '🎯', { color: AI }),
  c('ai-jupyter', 'Jupyter Notebook', '📓', { color: '#F37626' }),
  c('ai-langchain', 'LangChain', '🔗', { color: AI }),
  c('ai-llm', 'LLM (Large Language Model)', '🧠', { color: AI }),
  c('ai-mlflow', 'MLflow', '🌊', { color: '#0194E2' }),
  c('ai-model-registry', 'Model Registry', '📚', { shape: 'cylinder', color: AI }),
  c('ai-prompt-cache', 'Prompt / Response Cache', '💾', { shape: 'cylinder', color: AI }),
  c('ai-pytorch', 'PyTorch', '🔥', { color: '#EE4C2C' }),
  c('ai-tensorflow', 'TensorFlow', '🟠', { color: '#FF6F00' }),
  c('ai-training-pipeline', 'Training Pipeline', '🏋️', { color: AI }),
  c('ai-vector-db', 'Vector Database', '🧭', { shape: 'cylinder', color: AI }),
];
