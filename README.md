# Tinix Trending

An AI/ML Repository and Model Trending Tracker that monitors, aggregates, and visualizes daily activity and growth metrics from **GitHub** and **HuggingFace**.

---

## 🇻🇳 Giới thiệu (Vietnamese)

**Tinix Trending** là hệ thống theo dõi và phân tích xu hướng của các mã nguồn mở (repositories), mô hình trí tuệ nhân tạo (models) và tập dữ liệu (datasets) trên hai nền tảng phổ biến nhất hiện nay: **GitHub** và **HuggingFace**. 

Hệ thống tự động cào dữ liệu, ghi nhận các chỉ số hoạt động hàng ngày (Stars, Forks, Downloads, Likes) và tính toán xu hướng tăng trưởng theo các mốc thời gian (Daily, Weekly, Monthly Growth) để giúp các nhà phát triển và nhà nghiên cứu AI dễ dàng cập nhật những công nghệ AI/ML mới nổi và phổ biến nhất.

---

## 🎨 Design Language (Triết lý thiết kế)

Tinix Trending được xây dựng dựa trên triết lý thiết kế tối giản, hiện đại và cao cấp lấy cảm hứng từ Apple (chi tiết trong [DESIGN.md](file:///c:/Users/vutm/Desktop/workspace/tinix-repo-trending/DESIGN.md)):
- **Photography-first / Content-first**: Giao diện tập trung tối đa vào thông tin dự án, loại bỏ tất cả các chi tiết trang trí thừa thãi.
- **Alternating Canvases**: Các khu vực hiển thị đan xen giữa nền trắng sáng (`#ffffff`), xám giấy parchment (`#f5f5f7`) và các ô màu tối gần đen (`#272729`). Sự thay đổi màu nền đóng vai trò là dải phân cách tự nhiên thay cho các đường kẻ border truyền thống.
- **Single Action Color**: Chỉ sử dụng một màu xanh chủ đạo duy nhất đại diện cho tương tác (`Action Blue` — `#0066cc`).
- **Signature Typography**: Trải nghiệm đọc cao cấp bằng font chữ SF Pro Display / Inter với khoảng cách chữ được điều chỉnh chặt chẽ (`letter-spacing` âm cho tiêu đề hiển thị).

---

## 🚀 Key Features

- **Multi-Source Crawling:**
  - **GitHub:** Track stars, forks, open issues, readme, languages, licenses, and contributors count.
  - **HuggingFace:** Track downloads, likes, model/dataset metadata, readme description, and tags.
- **Growth-Based Trending Indicators:** Real-time and daily aggregated statistics calculating growth metrics over 1 day, 7 days, and 30 days.
- **Advanced Leaderboard Sorting:** Dynamic sorting of repositories and models by:
  - Daily growth rate (default sorting for active trends)
  - Raw star counts, downloads, or likes
  - Total forks, open issues, and contributor counts
- **Interactive Metrics History:** Interactive charts built with **Recharts** showing index updates (stars/downloads) over time.
- **Apple-inspired UI System:** Frosted-glass sticky sub-navigation bars, rounded capsule badges (`rounded.pill`), custom modal dialogues, and smooth interactive click micro-animations (`transform: scale(0.95)`).
- **Internationalization (i18n):** Complete localized UI support for English (`en`) and Vietnamese (`vi`) powered by `next-intl`.
- **Markdown CMS / Admin Dashboard:** Rich administrator panel for managing Markdown articles and developer documentation.
- **Project Submission:** Allow community members to submit AI/ML repositories and models for automatic indexing.

---

## 🏗️ Architecture Overview

The system consists of three main parts: **Next.js Web UI**, **BullMQ Workers Engine**, and **PostgreSQL Database** managed via **Drizzle ORM**.

```mermaid
graph TD
    subgraph External Sources
        GH[GitHub API]
        HF[HuggingFace API]
    end

    subgraph Crawler Engine (BullMQ + Redis)
        SW[Scheduler Worker] -->|Periodically Enqueues Job| CQ[BullMQ Redis Queue]
        CW[GitHub Crawler Worker] -.->|Pulls Job| CQ
        HW[HuggingFace Crawler Worker] -.->|Pulls Job| CQ
    end

    CW -->|Fetches Data| GH
    HW -->|Fetches Data| HF

    subgraph Data Layer
        Drizzle[Drizzle ORM] --> DB[(PostgreSQL Database)]
    end

    CW -->|Saves Snapshots & Trends| Drizzle
    HW -->|Saves Snapshots & Trends| Drizzle

    subgraph Web App (Next.js 16+)
        UI[Apple-Inspired Dashboard]
        Admin[Markdown CMS & Submit Form]
    end

    UI -->|Queries Trends/Snapshots| Drizzle
    Admin -->|Submits Projects| Drizzle
```

### Components:
1. **Scheduler Worker ([scheduler-worker.ts](file:///c:/Users/vutm/Desktop/workspace/tinix-repo-trending/src/workers/scheduler-worker.ts)):** A cron-like process that schedules projects for crawls based on their crawl intervals and updates the `next_crawl_at` timestamps in PostgreSQL.
2. **GitHub Crawler Worker ([crawler-worker.ts](file:///c:/Users/vutm/Desktop/workspace/tinix-repo-trending/src/workers/crawler-worker.ts)):** Processes queued GitHub jobs, crawls repository metadata, reads the raw readme text, parses topics/categories, and saves snapshots.
3. **HuggingFace Crawler Worker ([hf-worker.ts](file:///c:/Users/vutm/Desktop/workspace/tinix-repo-trending/src/workers/hf-worker.ts)):** Processes queued HuggingFace jobs, parses model tags, downloads count, and likes, and updates project tables.
4. **Database & ORM:** Drizzle ORM translates schemas and connects the background queue pipelines with the Next.js frontend pages directly.

---

## 💾 Database Schema

The database model is defined in [schema.ts](file:///c:/Users/vutm/Desktop/workspace/tinix-repo-trending/src/lib/db/schema.ts) using Drizzle ORM:

### 1. `projects`
Stores the core metadata of tracked repositories, models, or datasets.
- `id` (UUID, Primary Key)
- `source` ('github' | 'huggingface')
- `projectType` ('repository' | 'model' | 'dataset')
- `slug` (Unique path, e.g. `facebook/llama`)
- `name` & `fullName`
- `description` & `readme` (Raw Markdown content)
- `topics` & `categories` (JSONB Arrays)
- `sourceCreatedAt` & `sourceUpdatedAt` (Original creation dates from source)
- `nextCrawlAt` & `lastCrawledAt` (Queue scheduler control timestamps)

### 2. `project_snapshots`
Daily records of metrics to draw historical analytics graphs.
- `id` (UUID, Primary Key)
- `projectId` (Foreign Key referencing `projects.id`)
- `stars`, `forks`, `openIssues`, `watchers`, `contributorsCount`
- `downloads`, `likes`
- `snapshotDate` (Date)

### 3. `project_trends`
Fast cache table of pre-calculated growth rates.
- `projectId` (Primary Key referencing `projects.id`)
- `dailyStars`, `weeklyStars`, `monthlyStars` (GitHub growth)
- `dailyDownloads`, `weeklyDownloads`, `monthlyDownloads` (HuggingFace growth)
- `updatedAt` (Timestamp)

---

## 🛠️ Getting Started & Setup

### Prerequisites
- **Node.js:** v20 or higher
- **PostgreSQL:** v15 or higher (Host port `5433` is recommended if running multiple DBs)
- **Redis:** v7 or higher (Required for BullMQ queue processing)

### 1. Setup Environment
Clone the `.env.example` (or edit `.env` directly) with your connection URLs:

```ini
# Database Connection (Docker Postgres on port 5433)
DATABASE_URL="postgres://postgres:postgrespassword@localhost:5433/tinix_trending"

# Redis Connection (BullMQ)
REDIS_HOST="localhost"
REDIS_PORT="6379"

# GitHub API Token (Recommended to prevent rate limiting)
GITHUB_TOKEN="your_github_personal_access_token"

# Proxies (Optional, comma-separated to bypass HuggingFace/GitHub IP blocks)
PROXY_URLS=""
```

### 2. Launch Local Database & Redis
You can spin up PostgreSQL and Redis instantly using Docker:
```bash
docker-compose up -d
```
This runs PostgreSQL on port `5433` (DB name: `tinix_trending`) and Redis on port `6379` according to [docker-compose.yml](file:///c:/Users/vutm/Desktop/workspace/tinix-repo-trending/docker-compose.yml).

### 3. Install Dependencies
```bash
npm install
```

### 4. Setup Database Tables
Push Drizzle schema definitions to PostgreSQL:
```bash
npm run db:push
```
To seed initial projects list from local compressed data (fast, recommended):
```bash
npm run db:seed
```
Alternatively, to fetch and queue a fresh list of up to 100,000 repositories directly from remote APIs:
```bash
npm run bootstrap
npm run bootstrap:hf
```

### 5. Running the Application

You have multiple scripts available in [package.json](file:///c:/Users/vutm/Desktop/workspace/tinix-repo-trending/package.json):

#### A. Run Frontend & Crawlers Together (Development Mode)
```bash
npm run dev:all
```
This concurrently starts:
- The Next.js Next dev environment (powered by [dev.ts](file:///c:/Users/vutm/Desktop/workspace/tinix-repo-trending/dev.ts)).
- The BullMQ scheduler process.
- Both crawler workers (GitHub and HuggingFace).

#### B. Run Frontend Only
```bash
npm run dev
```

#### C. Run Background Workers Only
```bash
npm run start:workers
```

#### D. Production Deployment via PM2
To launch and manage the dashboard plus all worker queues in production using PM2:
```bash
npm run pm2:start
```
To stop the services:
```bash
npm run pm2:stop
```

---

## 📈 Quality Verification & Checklist

The project includes an automatic verification pipeline:
- **Lint Check:** `npm run lint`
- **TypeScript compilation check:** `npx tsc --noEmit`
- **Verification Audit:** Run the validation checklist script:
  ```bash
  python -X utf8 .agent/scripts/checklist.py .
  ```
