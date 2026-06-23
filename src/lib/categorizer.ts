import { db } from "./db";
import { categories as categoriesTable } from "./db/schema";

interface CategoryConfig {
  id: string;
  icon: string;
  color: string;
  keywords: string[];
}

export const DEFAULT_CATEGORIES: CategoryConfig[] = [
  { id: "LLM", icon: "🧠", color: "#8b5cf6", keywords: ["llm", "large-language-model", "text-generation", "text2text-generation", "gpt", "llama", "chatgpt", "conversational", "transformers"] },
  { id: "AI Agent", icon: "🤖", color: "#3b82f6", keywords: ["agent", "agents", "autonomous-agents", "auto-gpt", "langchain", "llamaindex", "autogen", "ai-agent"] },
  { id: "RAG", icon: "🔍", color: "#10b981", keywords: ["rag", "retrieval-augmented-generation", "vector-database", "vector-search", "semantic-search"] },
  { id: "Computer Vision", icon: "👁️", color: "#f59e0b", keywords: ["computer-vision", "vision", "image-generation", "text-to-image", "image-to-image", "stable-diffusion", "diffusers", "object-detection", "image-classification"] },
  { id: "Audio & Speech", icon: "🎙️", color: "#ec4899", keywords: ["audio", "speech-recognition", "text-to-speech", "audio-to-audio", "voice", "whisper", "tts", "asr", "voice-clone", "speech-to-text"] },
  { id: "Model Training", icon: "🏋️", color: "#ef4444", keywords: ["fine-tuning", "peft", "lora", "qlora", "alignment", "rlhf", "training"] },
  { id: "Data Engineering", icon: "📊", color: "#6366f1", keywords: ["data-engineering", "dataset", "data-processing", "crawling", "scraping", "etl", "data-science", "data-analysis", "analytics"] },
  { id: "Developer Tools", icon: "🛠️", color: "#64748b", keywords: ["developer-tools", "devtools", "cli", "sdk", "api-client", "testing", "vibe-coding", "cursor-rules", "mcp", "mcp-server", "ai-coding", "copilot"] },
  { id: "Frontend", icon: "🎨", color: "#06b6d4", keywords: ["frontend", "react", "nextjs", "vue", "tailwindcss", "ui-components", "web"] },
  { id: "Backend", icon: "⚙️", color: "#14b8a6", keywords: ["backend", "api", "nodejs", "python", "go", "rust", "database", "sql"] },
  { id: "DevOps", icon: "🚀", color: "#f97316", keywords: ["devops", "docker", "kubernetes", "ci-cd", "deployment", "infrastructure"] },
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
