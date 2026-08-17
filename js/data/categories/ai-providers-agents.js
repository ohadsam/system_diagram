import { c } from '../schema.js';

// "AI Providers & Agents" — the generative-AI world: model providers,
// specific model families, the Model Context Protocol (MCP), agents/agent
// frameworks, and the skills/tools/RAG building blocks around them.
// Complements the "AI / ML" category (which covers general ML *infra*:
// training pipelines, feature stores, vector DBs, ...) rather than
// duplicating it.
export const category = { id: 'ai-agents', label: 'AI Providers & Agents', color: '#6D28D9' };

const AI = '#6D28D9';

export const components = [
  // Providers
  c('ai-provider-anthropic', 'Anthropic (Claude)', '🟠', { popular: true, color: AI, tags: ['provider', 'llm'], description: 'Anthropic API — Claude models.', related: ['ai-model-claude'] }),
  c('ai-provider-aws-bedrock', 'AWS Bedrock', '🪨', { color: AI, tags: ['provider', 'aws', 'llm'], description: 'Managed access to multiple foundation models on AWS.' }),
  c('ai-provider-azure-openai', 'Azure OpenAI Service', '🔷', { color: AI, tags: ['provider', 'azure', 'llm'], related: ['ai-model-gpt'] }),
  c('ai-provider-cohere', 'Cohere', '🟣', { color: AI, tags: ['provider', 'llm', 'embeddings'] }),
  c('ai-provider-deepseek', 'DeepSeek', '🔍', { color: AI, tags: ['provider', 'llm'], related: ['ai-model-deepseek'] }),
  c('ai-provider-google', 'Google AI (Gemini)', '🔵', { color: AI, tags: ['provider', 'llm'], related: ['ai-model-gemini'] }),
  c('ai-provider-groq', 'Groq', '⚡', { color: AI, tags: ['provider', 'inference', 'llm'], description: 'Ultra-low-latency LPU inference.' }),
  c('ai-provider-huggingface', 'Hugging Face', '🤗', { color: AI, tags: ['provider', 'hub', 'models'] }),
  c('ai-provider-meta', 'Meta AI (Llama)', '♾️', { color: AI, tags: ['provider', 'llm'], related: ['ai-model-llama'] }),
  c('ai-provider-mistral', 'Mistral AI', '🌬️', { color: AI, tags: ['provider', 'llm'], related: ['ai-model-mistral'] }),
  c('ai-provider-nvidia-nim', 'NVIDIA NIM', '🟩', { color: AI, tags: ['provider', 'inference'] }),
  c('ai-provider-ollama', 'Ollama (Local Models)', '🦙', { color: AI, tags: ['provider', 'local', 'self-hosted'] }),
  c('ai-provider-openai', 'OpenAI', '🤖', { popular: true, color: AI, tags: ['provider', 'llm'], description: 'OpenAI API — GPT models.', related: ['ai-model-gpt', 'ai-model-dalle', 'ai-model-whisper'] }),
  c('ai-provider-perplexity', 'Perplexity AI', '❓', { color: AI, tags: ['provider', 'search', 'llm'] }),
  c('ai-provider-replicate', 'Replicate', '🔁', { color: AI, tags: ['provider', 'hosting', 'models'] }),
  c('ai-provider-stabilityai', 'Stability AI', '🎨', { color: AI, tags: ['provider', 'image-generation'], related: ['ai-model-stable-diffusion'] }),
  c('ai-provider-togetherai', 'Together AI', '🤝', { color: AI, tags: ['provider', 'inference', 'llm'] }),
  c('ai-provider-xai', 'xAI (Grok)', '✖️', { color: AI, tags: ['provider', 'llm'], related: ['ai-model-grok'] }),

  // Models
  c('ai-model-claude', 'Claude Model', '🎭', { color: AI, tags: ['model', 'llm'], related: ['ai-provider-anthropic'] }),
  c('ai-model-dalle', 'DALL·E (Image Generation)', '🖼️', { color: AI, tags: ['model', 'image-generation'], related: ['ai-provider-openai'] }),
  c('ai-model-deepseek', 'DeepSeek Model', '🔍', { color: AI, tags: ['model', 'llm'], related: ['ai-provider-deepseek'] }),
  c('ai-model-gemini', 'Gemini Model', '♊', { color: AI, tags: ['model', 'llm', 'multimodal'], related: ['ai-provider-google'] }),
  c('ai-model-gpt', 'GPT Model', '🧠', { color: AI, tags: ['model', 'llm'], related: ['ai-provider-openai'] }),
  c('ai-model-grok', 'Grok Model', '✖️', { color: AI, tags: ['model', 'llm'], related: ['ai-provider-xai'] }),
  c('ai-model-llama', 'Llama Model', '🦙', { color: AI, tags: ['model', 'llm', 'open-source'], related: ['ai-provider-meta'] }),
  c('ai-model-mistral', 'Mistral Model', '🌬️', { color: AI, tags: ['model', 'llm', 'open-source'], related: ['ai-provider-mistral'] }),
  c('ai-model-multimodal', 'Multimodal Model', '🖇️', { color: AI, tags: ['model', 'vision', 'audio'] }),
  c('ai-model-reasoning', 'Reasoning Model', '🧩', { color: AI, tags: ['model', 'llm'] }),
  c('ai-model-stable-diffusion', 'Stable Diffusion', '🎨', { color: AI, tags: ['model', 'image-generation'], related: ['ai-provider-stabilityai'] }),
  c('ai-model-whisper', 'Whisper (Speech-to-Text)', '🎙️', { color: AI, tags: ['model', 'speech'], related: ['ai-provider-openai'] }),

  // MCP (Model Context Protocol)
  c('ai-mcp-client', 'MCP Client', '🔗', { color: AI, tags: ['mcp', 'protocol'], description: 'Connects an AI app/agent to MCP servers.', related: ['ai-mcp-server'] }),
  c('ai-mcp-prompt', 'MCP Prompt', '📝', { color: AI, tags: ['mcp', 'protocol'] }),
  c('ai-mcp-resource', 'MCP Resource', '📂', { color: AI, tags: ['mcp', 'protocol'] }),
  c('ai-mcp-server', 'MCP Server', '🔌', { color: AI, tags: ['mcp', 'protocol'], description: 'Exposes tools/resources/prompts to AI clients over MCP.', related: ['ai-mcp-client', 'ai-mcp-tool'] }),
  c('ai-mcp-tool', 'MCP Tool', '🛠️', { color: AI, tags: ['mcp', 'protocol', 'tool-calling'], related: ['ai-mcp-server'] }),

  // Agents & agent frameworks
  c('ai-agent', 'AI Agent', '🤖', { color: AI, tags: ['agent'], description: 'An LLM-driven actor that plans and takes actions.', related: ['ai-agent-memory', 'ai-agent-planner', 'ai-tool-function-calling'] }),
  c('ai-agent-memory', 'Agent Memory', '🧠', { color: AI, tags: ['agent', 'state'], related: ['ai-agent'] }),
  c('ai-agent-orchestrator', 'Multi-Agent Orchestrator', '🎼', { color: AI, tags: ['agent', 'orchestration'], related: ['ai-subagent'] }),
  c('ai-agent-planner', 'Agent Planner', '🗺️', { color: AI, tags: ['agent', 'planning'], related: ['ai-agent'] }),
  c('ai-framework-autogen', 'AutoGen', '🔄', { color: AI, tags: ['agent-framework'] }),
  c('ai-framework-crewai', 'CrewAI', '👥', { color: AI, tags: ['agent-framework'] }),
  c('ai-framework-langgraph', 'LangGraph', '🕸️', { color: AI, tags: ['agent-framework'] }),
  c('ai-framework-llamaindex', 'LlamaIndex', '🦙', { color: AI, tags: ['agent-framework', 'rag'], related: ['ai-rag-pipeline'] }),
  c('ai-framework-semantic-kernel', 'Semantic Kernel', '🧿', { color: AI, tags: ['agent-framework'] }),
  c('ai-subagent', 'Sub-Agent', '🧬', { color: AI, tags: ['agent'], related: ['ai-agent-orchestrator'] }),

  // Skills, tools & RAG
  c('ai-chat-endpoint', 'Chat Completion Endpoint', '💬', { color: AI, tags: ['api', 'llm'] }),
  c('ai-fine-tuning', 'Fine-Tuning Job', '🎛️', { color: AI, tags: ['training', 'customization'] }),
  c('ai-guardrails', 'Guardrails / Content Moderation', '🚧', { color: AI, tags: ['safety'] }),
  c('ai-inference-api', 'Inference API', '🔌', { color: AI, tags: ['api'] }),
  c('ai-knowledge-base', 'Knowledge Base', '📖', { shape: 'cylinder', color: AI, tags: ['rag', 'storage'], related: ['ai-rag-pipeline'] }),
  c('ai-prompt-template', 'Prompt Template', '📝', { color: AI, tags: ['prompt'] }),
  c('ai-rag-pipeline', 'RAG Pipeline', '🔍', { color: AI, tags: ['rag', 'retrieval'], description: 'Retrieval-Augmented Generation pipeline.', related: ['ai-vector-db', 'ai-reranker', 'ai-knowledge-base'] }),
  c('ai-reranker', 'Reranker', '📶', { color: AI, tags: ['rag', 'retrieval'], related: ['ai-rag-pipeline'] }),
  c('ai-skill', 'Skill', '🧩', { color: AI, tags: ['skill', 'capability'], description: 'A packaged, reusable capability an agent can invoke.' }),
  c('ai-skill-library', 'Skill Library', '📚', { shape: 'cylinder', color: AI, tags: ['skill', 'storage'] }),
  c('ai-system-prompt', 'System Prompt', '📜', { color: AI, tags: ['prompt'] }),
  c('ai-tool-function-calling', 'Function / Tool Calling', '🛠️', { color: AI, tags: ['tool-calling'] }),
];
