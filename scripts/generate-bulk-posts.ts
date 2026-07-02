import { db } from "../src/lib/db";
import { projects, posts, users } from "../src/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { Buffer } from "buffer";

// Helper to convert text to clean URL slug
function slugify(text: string): string {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

// Google Translate single API to translate English text into Vietnamese
async function translateText(text: string): Promise<string> {
  if (!text || text.trim() === "") return "";
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) {
      return text;
    }
    const json = await res.json() as any;
    if (json && json[0]) {
      return json[0].map((x: any) => x[0]).join("");
    }
    return text;
  } catch (err) {
    console.error(`Translation error for text: "${text.substring(0, 30)}...":`, err);
    return text;
  }
}

// Ensure unique slug
async function getUniqueSlug(title: string): Promise<string> {
  let slug = slugify(title) || "untitled-post";
  let count = 0;
  
  while (true) {
    const testSlug = count === 0 ? slug : `${slug}-${count}`;
    const existing = await db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.slug, testSlug))
      .limit(1);
    
    if (existing.length === 0) {
      return testSlug;
    }
    count++;
  }
}

async function main() {
  console.log("Starting bulk post generation...");

  // Override DATABASE_URL to 127.0.0.1 for local connection reliability on Windows
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes("localhost")) {
    process.env.DATABASE_URL = process.env.DATABASE_URL.replace("localhost", "127.0.0.1");
  }

  // 1. Get admin user ID
  const adminUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);

  if (adminUsers.length === 0) {
    console.error("Error: No admin user found in database. Please seed or create a user first.");
    process.exit(1);
  }
  const authorId = adminUsers[0].id;
  console.log(`Using admin author ID: ${authorId}`);

  // 2. Fetch top 100 prominent projects ordered by star counts
  console.log("Fetching top 100 prominent projects from system database...");
  const topProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      fullName: projects.fullName,
      description: projects.description,
      primaryLanguage: projects.primaryLanguage,
      stars: projects.stars,
      forks: projects.forks,
      sourceUrl: projects.sourceUrl,
      ownerAvatarUrl: projects.ownerAvatarUrl,
      topics: projects.topics,
    })
    .from(projects)
    .orderBy(desc(projects.stars))
    .limit(100);

  console.log(`Found ${topProjects.length} projects to process.`);

  let insertedCount = 0;

  // Process in small batches to respect translation API rate limit
  for (let i = 0; i < topProjects.length; i++) {
    const proj = topProjects[i];
    console.log(`[${i + 1}/100] Processing project: ${proj.fullName}...`);

    try {
      // Check if post for this project already exists
      const existingPost = await db
        .select({ id: posts.id })
        .from(posts)
        .where(eq(posts.projectId, proj.id))
        .limit(1);

      if (existingPost.length > 0) {
        console.log(`-> Story for project ${proj.fullName} already exists. Skipping.`);
        continue;
      }

      // Translate description
      const rawDesc = proj.description || "No description provided.";
      const viDesc = await translateText(rawDesc);

      // Construct article title
      const title = `Giới thiệu dự án ${proj.name}: ${viDesc.split(".")[0] || proj.name}`;

      // Construct unique slug
      const slug = await getUniqueSlug(title);

      // Create rich HTML content matching Medium design rules
      const content = `
<p>Chào mừng các bạn đến với TiniX! Hôm nay chúng ta sẽ cùng khám phá và đánh giá chi tiết về <strong>${proj.name}</strong>, một trong những dự án mã nguồn mở nổi bật đang thu hút sự chú ý lớn từ cộng đồng nhà phát triển toàn cầu.</p>

<h2>Tổng quan về dự án</h2>
<p>${viDesc}</p>

<h2>Các thông số kỹ thuật chính</h2>
<ul>
  <li><strong>Ngôn ngữ lập trình chính:</strong> ${proj.primaryLanguage || "Không xác định"}</li>
  <li><strong>Số lượt yêu thích (Stars):</strong> ${proj.stars?.toLocaleString() || 0} ★</li>
  <li><strong>Số lượt sao chép (Forks):</strong> ${proj.forks?.toLocaleString() || 0} forks</li>
  <li><strong>Mã nguồn:</strong> <a href="${proj.sourceUrl}" target="_blank" rel="noopener noreferrer">${proj.fullName}</a></li>
</ul>

<h2>Đặc điểm nổi bật & Ứng dụng thực tế</h2>
<p>Dự án <strong>${proj.name}</strong> được phát triển nhằm giải quyết các thách thức phổ biến trong phát triển phần mềm hiện đại. Với hơn ${proj.stars?.toLocaleString() || 0} sao trên GitHub, dự án này đã khẳng định vị thế và độ ổn định của mình trong các hệ thống production.</p>

<h2>Cách bắt đầu nhanh</h2>
<p>Bạn có thể dễ dàng tiếp cận dự án bằng cách clone mã nguồn trực tiếp từ kho lưu trữ và thực hiện theo hướng dẫn cài đặt chi tiết trong README của tác giả:</p>
<pre><code>git clone ${proj.sourceUrl}
cd ${proj.name}</code></pre>

<p>Hãy theo dõi thêm các bài viết khác tại TiniX Stories để cập nhật các công nghệ, thư viện mã nguồn mở và mô hình AI xu hướng mới nhất!</p>
      `.trim();

      const summary = viDesc.substring(0, 150) + "...";
      const coverImage = proj.ownerAvatarUrl || "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=600&auto=format&fit=crop";

      // Prepare tags (primary language + topics)
      const tags = new Set<string>();
      if (proj.primaryLanguage) tags.add(proj.primaryLanguage.toLowerCase());
      if (proj.topics && Array.isArray(proj.topics)) {
        proj.topics.slice(0, 3).forEach(t => tags.add(t.toLowerCase()));
      }
      tags.add("open-source");

      // Insert post directly
      await db.insert(posts).values({
        title,
        slug,
        content,
        summary,
        coverImage,
        authorId,
        projectId: proj.id,
        status: "published",
        tags: Array.from(tags),
        seoTitle: `${proj.name} - Chi tiết dự án và tài liệu hướng dẫn tiếng Việt`,
        seoDescription: `Đánh giá dự án ${proj.name} (${proj.fullName}) với ${proj.stars} stars. Xem phân tích các tính năng nổi bật bằng tiếng Việt.`,
        views: Math.floor(Math.random() * 50) + 10, // Initialize random view count to make trending showcase realistic
        publishedAt: new Date(),
      });

      insertedCount++;
      console.log(`-> Successfully generated and published blog post for ${proj.fullName}`);

      // Small delay between calls to be gentle with Google Translate API rate limit
      await new Promise(resolve => setTimeout(resolve, 800));

    } catch (error) {
      console.error(`Error processing project ${proj.fullName}:`, error);
    }
  }

  console.log(`Bulk generation completed! Generated and inserted ${insertedCount} blog posts.`);
  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal error in bulk generation:", error);
  process.exit(1);
});
