export type ProjectSource = "github" | "huggingface" | "paperwithcode";

export interface Project {
  id: string;
  source: ProjectSource;
  projectType: "repository" | "model" | "dataset";
  sourceId: string;
  slug: string;
  name: string;
  fullName: string;
  description: string;
  aiSummary?: string;
  homepageUrl?: string;
  sourceUrl: string;
  primaryLanguage?: string;
  license?: string;
  ownerName: string;
  ownerAvatarUrl: string;
  ownerType: "user" | "org";
  topics: string[];
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;
  downloads?: number;
  contributorsCount?: number;
  createdAt: string;
  updatedAt: string;
  sourceCreatedAt: string;
  sourceUpdatedAt?: string;
  lastCrawledAt: string;
}

export interface ProjectSnapshot {
  id: string;
  projectId: string;
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;
  downloads?: number;
  snapshotDate: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  parentId?: string;
  sortOrder?: number;
  projectCount?: number;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  color: string;
}

export interface Ranking {
  id: string;
  projectId: string;
  period: "daily" | "weekly" | "monthly" | "yearly";
  rankingDate: string;
  rank: number;
  score: number;
  starsGained: number;
  forksGained: number;
  velocityScore: number;
  momentumScore: number;
}

export interface Review {
  id: string;
  projectId: string;
  userId: string;
  rating: number;
  title: string;
  content: string;
  helpfulCount: number;
  createdAt: string;
  user: {
    username: string;
    displayName: string;
    avatarUrl: string;
  };
}

export interface RankedProject extends Project {
  rank: number;
  score: number;
  starsGained: number;
  forksGained: number;
  downloadsGained?: number;
  velocityScore: number;
  momentumScore: number;
  categories: Category[];
  tags: Tag[];
  sparklineData?: number[];
}

export type RankingPeriod = "daily" | "weekly" | "monthly" | "yearly";
export type ViewMode = "card" | "table" | "compact";
export type SortField = "rank" | "stars" | "starsGained" | "forks" | "score";
