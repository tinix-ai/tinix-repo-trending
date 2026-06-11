const CATEGORY_MAP: Record<string, string[]> = {
  "LLM": ["llm", "large-language-model", "text-generation", "text2text-generation", "gpt", "llama", "chatgpt", "conversational", "transformers"],
  "AI Agent": ["agent", "agents", "autonomous-agents", "auto-gpt", "langchain", "llamaindex", "autogen", "ai-agent"],
  "RAG": ["rag", "retrieval-augmented-generation", "vector-database", "vector-search", "semantic-search"],
  "Computer Vision": ["computer-vision", "vision", "image-generation", "text-to-image", "image-to-image", "stable-diffusion", "diffusers", "object-detection", "image-classification"],
  "Audio & Speech": ["audio", "speech-recognition", "text-to-speech", "audio-to-audio", "voice", "whisper"],
  "Model Training": ["fine-tuning", "peft", "lora", "qlora", "alignment", "rlhf", "training"],
  "Data Engineering": ["data-engineering", "dataset", "data-processing", "crawling", "scraping", "etl"],
  "Developer Tools": ["developer-tools", "devtools", "cli", "sdk", "api-client", "testing"],
  "Frontend": ["frontend", "react", "nextjs", "vue", "tailwindcss", "ui-components", "web"],
  "Backend": ["backend", "api", "nodejs", "python", "go", "rust", "database", "sql"],
  "DevOps": ["devops", "docker", "kubernetes", "ci-cd", "deployment", "infrastructure"],
};

export const CATEGORY_METADATA: Record<string, { icon: string, color: string }> = {
  "LLM": { icon: "🧠", color: "#8b5cf6" },
  "AI Agent": { icon: "🤖", color: "#3b82f6" },
  "RAG": { icon: "🔍", color: "#10b981" },
  "Computer Vision": { icon: "👁️", color: "#f59e0b" },
  "Audio & Speech": { icon: "🎙️", color: "#ec4899" },
  "Model Training": { icon: "🏋️", color: "#ef4444" },
  "Data Engineering": { icon: "📊", color: "#6366f1" },
  "Developer Tools": { icon: "🛠️", color: "#64748b" },
  "Frontend": { icon: "🎨", color: "#06b6d4" },
  "Backend": { icon: "⚙️", color: "#14b8a6" },
  "DevOps": { icon: "🚀", color: "#f97316" },
  "AI Models": { icon: "📦", color: "#8b5cf6" },
  "Datasets": { icon: "📂", color: "#10b981" },
};

export function categorizeProject(tags: string[], type: 'repository' | 'model' | 'dataset'): string[] {
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
