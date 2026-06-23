import { db } from "./db";
import { categories as categoriesTable } from "./db/schema";

interface CategoryConfig {
  id: string;
  icon: string;
  color: string;
  keywords: string[];
}

export const DEFAULT_CATEGORIES: CategoryConfig[] = [
  // --- AI/ML Core ---
  { id: "LLM", icon: "🧠", color: "#8b5cf6", keywords: [
    "llm", "llms", "large-language-model", "large-language-models", "language-model",
    "text-generation", "text2text-generation", "text-generation-inference",
    "gpt", "gpt2", "gpt4", "gpt-3", "gpt-4", "chatgpt", "chatgpt-api", "openai", "openai-api",
    "llama", "llama2", "llama3", "llama-2", "llama-3", "llama.cpp", "llama-cpp", "llamacpp",
    "conversational", "transformers", "transformers.js", "transformer",
    "deepseek", "reasoning", "chain-of-thought", "thinking",
    "fingpt", "financial-ai", "r1",
    "mistral", "mixtral", "qwen", "qwen2", "qwen3", "qwen3_5", "qwen3_5_moe", "qwen3_moe", "qwen3.5", "qwen3.6", "qwen2_5_vl", "qwen3_vl",
    "gemma", "gemma2", "gemma3", "gemma4",
    "bert", "roberta", "distilbert", "t5", "bloom", "bart", "deberta-v2", "xlm-roberta",
    "causal-lm", "instruct", "chatml", "chat",
    "ollama", "vllm", "llm-inference", "local-llm",
    "gguf", "GGUF", "gptq", "awq", "quantized", "quantization", "4-bit", "8-bit", "bfloat16", "fp8",
    "imatrix", "unsloth", "bitsandbytes", "safetensors",
    "uncensored", "abliterated", "merge", "mergekit", "moe", "mixture-of-experts",
    "long-context", "speculative-decoding", "compressed-tensors",
    "multimodal", "any-to-any", "vlm", "vision-language", "llava",
    "glm", "chatglm", "alpaca", "sft",
    "opencode", "codex", "code-generation", "coding",
    "anthropic", "claude", "claude-ai", "claude-code", "claude-skills",
    "gemini", "gemini-cli",
    "function-calling", "tool-use", "tool-calling",
    "prompt-engineering", "prompt",
    "generative-ai", "genai", "artificial-intelligence", "ai", "ai-tools", "ai-assistant",
    "foundation-models", "pretraining", "synthetic-data", "mteb"
  ]},
  { id: "AI Agent", icon: "🤖", color: "#3b82f6", keywords: [
    "agent", "agents", "ai-agent", "ai-agents", "autonomous-agents",
    "auto-gpt", "langchain", "llamaindex", "autogen",
    "skills", "skill", "agent-skills", "agent-framework",
    "agentic", "agentic-ai", "agentic-workflow",
    "multi-agent", "multi-agent-systems",
    "orchestration", "workflow", "workflow-automation",
    "chatbot", "telegram-bot", "assistant"
  ]},
  { id: "RAG", icon: "🔍", color: "#10b981", keywords: [
    "rag", "retrieval-augmented-generation", "information-retrieval",
    "vector-database", "vector-search", "vector", "semantic-search",
    "graphrag", "graph-rag", "knowledge-graph", "graph",
    "embeddings", "sentence-similarity", "sentence-transformers", "text-embeddings-inference",
    "search-engine", "elasticsearch"
  ]},
  { id: "NLP", icon: "📝", color: "#a855f7", keywords: [
    "nlp", "natural-language-processing",
    "text-classification", "token-classification", "zero-shot-classification",
    "fill-mask", "feature-extraction", "image-feature-extraction",
    "translation", "summarization", "question-answering",
    "text-ranking", "classification",
    "ocr", "multilingual",
    "sentence-similarity", "visual-question-answering"
  ]},
  { id: "Computer Vision", icon: "👁️", color: "#f59e0b", keywords: [
    "computer-vision", "vision",
    "image-generation", "text-to-image", "image-to-image", "image-to-text", "image-to-3d", "image-text-to-text",
    "stable-diffusion", "stable-diffusion-xl", "stable-diffusion-diffusers", "diffusers", "diffusion", "diffusion-single-file",
    "flux", "controlnet", "comfyui",
    "object-detection", "image-classification", "image-segmentation", "image-processing",
    "video-generation", "text-to-video", "image-to-video", "video-to-video", "video-text-to-text", "video",
    "zero-shot-image-classification", "depth-estimation",
    "clip", "yolo", "segmentation", "vit",
    "image", "opencv", "art"
  ]},
  { id: "Audio & Speech", icon: "🎙️", color: "#ec4899", keywords: [
    "audio", "audio-to-audio", "audio-classification", "audio-text-to-text", "text-to-audio",
    "speech-recognition", "speech-to-text", "speech", "speech-synthesis",
    "text-to-speech", "voice", "voice-clone",
    "whisper", "tts", "asr",
    "voicebox", "music", "automatic-speech-recognition", "music-player", "spotify",
    "wav2vec2", "nemo"
  ]},
  { id: "Model Training", icon: "🏋️", color: "#ef4444", keywords: [
    "fine-tuning", "finetune", "peft", "lora", "qlora",
    "alignment", "rlhf", "dpo", "training",
    "reinforcement-learning", "distillation",
    "trl", "axolotl", "mlops", "llmops",
    "neural-network", "neural-networks", "deep-learning", "deeplearning", "deep-neural-networks",
    "machine-learning", "machine-learning-algorithms", "machinelearning", "ml",
    "pytorch", "tensorflow", "jax", "keras", "onnx", "coreml", "openvino",
    "tensorboard", "scikit-learn",
    "benchmark", "eval-results", "evaluation",
    "cuda", "gpu", "apple-silicon", "mlx",
    "inference", "nvidia", "math", "synthetic"
  ]},
  { id: "Data Engineering", icon: "📊", color: "#6366f1", keywords: [
    "data-engineering", "dataset", "data-processing", "data",
    "crawling", "crawler", "scraping", "scraper", "etl",
    "data-science", "data-analysis", "analytics",
    "data-visualization", "visualization",
    "big-data", "statistics", "time-series", "time-series-forecasting", "forecasting",
    "data-structures", "algorithms",
    "pandas", "csv", "excel"
  ]},
  { id: "Developer Tools", icon: "🛠️", color: "#64748b", keywords: [
    "developer-tools", "devtools",
    "cli", "command-line", "command-line-tool", "terminal", "tui", "console",
    "sdk", "api-client",
    "testing", "testing-tools", "unit-testing", "tdd", "playwright",
    "vibe-coding", "cursor-rules", "ai-coding",
    "mcp", "mcp-server", "mcp-servers", "model-context-protocol",
    "copilot", "cursor", "cline", "windsurf", "bolt", "v0",
    "vscode", "vscode-extension", "ide", "neovim", "vim", "intellij-plugin",
    "linter", "static-analysis", "debugging",
    "editor", "plugin",
    "git", "github-actions",
    "compiler", "parser", "dsl",
    "package-manager", "homebrew",
    "dotfiles", "tmux", "zsh", "bash", "bash-script",
    "documentation", "pdf", "automation", "shell", "downloader", "composer", "boilerplate", "sandbox", "generator", "extension"
  ]},
  { id: "Frontend", icon: "🎨", color: "#06b6d4", keywords: [
    "frontend", "react", "reactjs", "nextjs", "vue", "vuejs", "vue3", "angular",
    "tailwindcss", "shadcn-ui", "material-ui", "material-design", "bootstrap",
    "ui-components", "component", "components", "ui", "design-system", "design",
    "web", "webapp", "website", "spa", "pwa",
    "css", "html", "html5", "svg", "canvas", "webgl",
    "animation", "font", "icons",
    "electron", "tauri", "desktop", "desktop-app",
    "svelte", "vite", "webpack", "vercel",
    "chart", "charts", "dashboard",
    "browser", "chrome-extension",
    "redux", "i18n",
    "markdown", "json", "xml", "yaml",
    "javascript", "typescript", "gui", "wpf", "jquery", "firefox", "chrome", "theme", "local-first", "calendar"
  ]},
  { id: "Backend", icon: "⚙️", color: "#14b8a6", keywords: [
    "backend", "api", "rest", "rest-api", "graphql", "grpc", "rpc", "openapi",
    "nodejs", "node", "python", "python3", "go", "golang", "rust", "rust-lang",
    "java", "kotlin", "csharp", "c-sharp", "cpp", "c-plus-plus", "cplusplus",
    "ruby", "ruby-on-rails", "rails", "php", "laravel", "symfony",
    "spring-boot", "spring", "springboot", "django", "fastapi", "flask",
    "dotnet", "dotnet-core", "dotnetcore", "aspnetcore", "asp-net-core", "blazor",
    "database", "sql", "postgresql", "postgres", "mysql", "sqlite", "mongodb", "nosql",
    "redis", "kafka", "rabbitmq",
    "orm", "activerecord", "mybatis",
    "microservices", "microservice", "clean-architecture",
    "websocket", "websockets", "http", "http-client", "https",
    "server", "middleware", "async", "asynchronous", "concurrency",
    "jwt", "oauth2", "authentication", "authorization",
    "streaming", "cache", "logging", "protobuf", "serialization",
    "distributed", "distributed-systems",
    "wordpress", "telegram", "discord", "webrtc", "email", "ecommerce", "slack", "messaging", "twitter", "dependency-injection", "rss", "cms", "swagger", "ddd"
  ]},
  { id: "DevOps", icon: "🚀", color: "#f97316", keywords: [
    "devops", "docker", "docker-compose", "docker-image", "containers", "container",
    "kubernetes", "k8s", "helm",
    "ci-cd", "deployment", "infrastructure",
    "aws", "azure", "cloud", "cloud-native", "serverless",
    "terraform", "prometheus", "grafana", "opentelemetry", "observability",
    "monitoring", "metrics",
    "nginx", "proxy", "vpn", "wireguard",
    "dns", "tls", "ssl",
    "linux", "ubuntu", "debian", "unix",
    "embedded", "firmware", "wasm", "webassembly",
    "self-hosted", "networking", "network", "ffmpeg", "compression", "edge", "backup", "cloudflare", "tcp", "s3", "firebase", "wayland", "termux", "filesystem"
  ]},
  // --- New Categories ---
  { id: "Security", icon: "🔒", color: "#dc2626", keywords: [
    "security", "security-tools", "cybersecurity",
    "hacking", "pentesting", "pentest", "penetration-testing", "bugbounty", "redteam",
    "reverse-engineering", "osint", "infosec",
    "encryption", "cryptography",
    "privacy",
    "scanner"
  ]},
  { id: "Blockchain & Web3", icon: "⛓️", color: "#f59e0b", keywords: [
    "blockchain", "ethereum", "bitcoin", "cryptocurrency", "crypto",
    "web3", "p2p", "decensored", "trading"
  ]},
  { id: "Mobile", icon: "📱", color: "#22c55e", keywords: [
    "android", "android-app", "android-application", "android-library", "android-ui", "android-development",
    "ios", "swift", "swiftui", "xcode", "uikit", "cocoapods", "swift-package-manager",
    "kotlin-android", "kotlin-multiplatform", "kotlin-coroutines", "jetpack-compose", "jetpack", "compose", "compose-multiplatform",
    "react-native", "flutter",
    "mobile", "cross-platform",
    "macos", "macos-app", "objective-c",
    "tvos", "watchos",
    "material-design", "mvvm", "coroutines",
    "camera", "navigation", "kotlin-library", "carthage", "retrofit2"
  ]},
  { id: "Game Development", icon: "🎮", color: "#a3e635", keywords: [
    "game", "games", "game-development", "game-engine", "gamedev",
    "unity", "unity3d",
    "opengl", "vulkan", "webgl", "metal", "shader", "graphics",
    "3d", "simulation",
    "minecraft", "lua", "emulator"
  ]},
  { id: "Robotics & IoT", icon: "🤖", color: "#0ea5e9", keywords: [
    "robotics", "ros",
    "iot", "raspberry-pi", "arduino", "esp32", "esp8266",
    "embedded", "bluetooth", "mqtt",
    "slam", "sensor", "home-assistant", "operating-system"
  ]},
];

export const CATEGORY_MAP: Record<string, string[]> = {};
export const CATEGORY_METADATA: Record<string, { icon: string, color: string }> = {
  "AI Models": { icon: "📦", color: "#8b5cf6" },
  "Datasets": { icon: "📂", color: "#10b981" },
};

let cacheLoadedAt = 0;
let loadingPromise: Promise<void> | null = null;

// Populates maps with defaults immediately so there is always synchronous fallback metadata
function loadDefaults() {
  for (const cat of DEFAULT_CATEGORIES) {
    CATEGORY_MAP[cat.id] = cat.keywords;
    CATEGORY_METADATA[cat.id] = { icon: cat.icon, color: cat.color };
  }
}
loadDefaults();

export async function ensureCategoriesLoaded(force = false) {
  const now = Date.now();
  if (force || now - cacheLoadedAt > 60000 || Object.keys(CATEGORY_MAP).length === 0) {
    if (!loadingPromise) {
      loadingPromise = reloadCategories();
    }
    await loadingPromise;
  }
}

async function reloadCategories() {
  try {
    const dbCategories = await db.select().from(categoriesTable);
    
    // Seed DB if empty
    if (dbCategories.length === 0) {
      console.log("[Categorizer] Categories table is empty. Seeding defaults...");
      const values = DEFAULT_CATEGORIES.map(cat => ({
        id: cat.id,
        icon: cat.icon,
        color: cat.color,
        keywords: cat.keywords,
      }));
      await db.insert(categoriesTable).values(values).onConflictDoNothing();
      // Reload again after seeding
      const reloaded = await db.select().from(categoriesTable);
      updateInMemoryMaps(reloaded);
    } else {
      updateInMemoryMaps(dbCategories);
    }
    
    cacheLoadedAt = Date.now();
  } catch (err) {
    console.error("[Categorizer] Failed to load categories from database, using defaults/in-memory state.", err);
  } finally {
    loadingPromise = null;
  }
}

function updateInMemoryMaps(cats: CategoryConfig[]) {
  // Clear CATEGORY_MAP in-place
  for (const key of Object.keys(CATEGORY_MAP)) {
    delete CATEGORY_MAP[key];
  }
  // Clear CATEGORY_METADATA (except fallbacks)
  const fallbacks = ["AI Models", "Datasets"];
  for (const key of Object.keys(CATEGORY_METADATA)) {
    if (!fallbacks.includes(key)) {
      delete CATEGORY_METADATA[key];
    }
  }

  // Populate maps
  for (const cat of cats) {
    CATEGORY_MAP[cat.id] = cat.keywords;
    CATEGORY_METADATA[cat.id] = { icon: cat.icon, color: cat.color };
  }
}

export async function categorizeProject(tags: string[], type: 'repository' | 'model' | 'dataset'): Promise<string[]> {
  await ensureCategoriesLoaded();

  if (!tags || tags.length === 0) return [];

  const matchedCategories = new Set<string>();
  const normalizedTags = tags.map(t => t.toLowerCase().trim());

  for (const tag of normalizedTags) {
    for (const [category, keywords] of Object.entries(CATEGORY_MAP)) {
      if (keywords.includes(tag) || keywords.some(k => tag.includes(k))) {
        matchedCategories.add(category);
      }
    }
  }

  // Fallbacks if no categories matched
  if (matchedCategories.size === 0) {
    if (type === 'model') matchedCategories.add("AI Models");
    if (type === 'dataset') matchedCategories.add("Datasets");
  }

  return Array.from(matchedCategories);
}
