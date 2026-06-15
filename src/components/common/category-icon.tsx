import React from "react";
import {
  Brain,
  Bot,
  Search,
  Eye,
  Mic,
  Dumbbell,
  Database,
  Wrench,
  Palette,
  Server,
  Rocket,
  Box,
  FolderHeart,
  Globe,
  Lock,
  Smartphone,
  MessageSquareCode,
  Zap,
  Tag
} from "lucide-react";

interface CategoryIconProps {
  icon?: string;
  name?: string;
  className?: string;
}

export function CategoryIcon({ icon, name, className = "w-3.5 h-3.5" }: CategoryIconProps) {
  const normName = name?.toLowerCase().trim() || "";
  const normIcon = icon || "";

  // Map by name or icon emoji
  if (normName === "llm" || normName.includes("llm & models") || normIcon === "🧠") {
    return <Brain className={className} />;
  }
  if (normName === "ai agent" || normName.includes("ai-agent") || normIcon === "🤖") {
    return <Bot className={className} />;
  }
  if (normName === "rag" || normIcon === "🔍") {
    return <Search className={className} />;
  }
  if (normName === "computer vision" || normIcon === "👁️") {
    return <Eye className={className} />;
  }
  if (normName === "audio & speech" || normName.includes("audio") || normIcon === "🎙️") {
    return <Mic className={className} />;
  }
  if (normName === "model training" || normIcon === "🏋️") {
    return <Dumbbell className={className} />;
  }
  if (normName === "data engineering" || normName.includes("data & analytics") || normIcon === "📊") {
    return <Database className={className} />;
  }
  if (normName === "developer tools" || normName.includes("dev tools") || normIcon === "🛠️") {
    return <Wrench className={className} />;
  }
  if (normName === "frontend" || normIcon === "🎨") {
    return <Palette className={className} />;
  }
  if (normName === "backend" || normName === "infrastructure" || normIcon === "⚙️") {
    return <Server className={className} />;
  }
  if (normName === "devops" || normName.includes("cloud") || normIcon === "🚀" || normIcon === "☁️") {
    return <Rocket className={className} />;
  }
  if (normName === "ai models" || normIcon === "📦") {
    return <Box className={className} />;
  }
  if (normName === "datasets" || normIcon === "📂") {
    return <FolderHeart className={className} />;
  }
  if (normName === "security" || normIcon === "🔒") {
    return <Lock className={className} />;
  }
  if (normName === "mobile" || normIcon === "📱") {
    return <Smartphone className={className} />;
  }
  if (normName === "nlp" || normIcon === "💬") {
    return <MessageSquareCode className={className} />;
  }
  if (normName === "automation" || normIcon === "⚡") {
    return <Zap className={className} />;
  }
  if (normName === "web framework" || normIcon === "🌐") {
    return <Globe className={className} />;
  }

  return <Tag className={className} />;
}
