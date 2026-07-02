"use server";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { posts, users, projects } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Helper to convert title to a clean SEO friendly slug
function slugify(text: string): string {
  return text
    .toString()
    .normalize("NFD") // split accented characters into their base characters and diacritical marks
    .replace(/[\u0300-\u036f]/g, "") // remove diacritical marks
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // replace spaces with -
    .replace(/[^\w\-]+/g, "") // remove all non-word chars
    .replace(/\-\-+/g, "-") // replace multiple - with single -
    .replace(/^-+/, "") // trim - from start of text
    .replace(/-+$/, ""); // trim - from end of text
}

// Ensure unique slug by appending random suffix if needed
async function getUniqueSlug(title: string, currentPostId?: string): Promise<string> {
  let slug = slugify(title) || "untitled-post";
  let count = 0;
  
  while (true) {
    const testSlug = count === 0 ? slug : `${slug}-${count}`;
    
    // Check if slug is used by other posts
    let query = db.select({ id: posts.id }).from(posts).where(eq(posts.slug, testSlug));
    const existing = await query.limit(1);
    
    if (existing.length === 0 || (currentPostId && existing[0].id === currentPostId)) {
      return testSlug;
    }
    
    count++;
  }
}

// 1. Create a blog post (as Draft)
export async function actionCreatePost(formData: {
  title: string;
  content: string;
  summary?: string;
  coverImage?: string;
  projectId?: string;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
}) {
  const session = await getSession();
  if (!session || !session.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const { title, content, summary, coverImage, projectId, tags, seoTitle, seoDescription } = formData;
    
    if (!title || !content) {
      return { success: false, error: "Title and content are required." };
    }

    const slug = await getUniqueSlug(title);

    const [newPost] = await db
      .insert(posts)
      .values({
        title,
        slug,
        content,
        summary: summary || title.substring(0, 150),
        coverImage,
        authorId: session.user.id,
        projectId: projectId || null,
        status: "draft",
        tags: tags || [],
        seoTitle: seoTitle || title,
        seoDescription: seoDescription || summary || title.substring(0, 150),
      })
      .returning();

    revalidatePath("/profile");
    return { success: true, postId: newPost.id, slug: newPost.slug };
  } catch (err: any) {
    console.error("Error creating post:", err);
    return { success: false, error: err.message || "Failed to create post" };
  }
}

// 2. Update an existing post
export async function actionUpdatePost(
  postId: string,
  formData: {
    title: string;
    content: string;
    summary?: string;
    coverImage?: string;
    projectId?: string;
    tags?: string[];
    seoTitle?: string;
    seoDescription?: string;
  }
) {
  const session = await getSession();
  if (!session || !session.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const { title, content, summary, coverImage, projectId, tags, seoTitle, seoDescription } = formData;
    
    if (!title || !content) {
      return { success: false, error: "Title and content are required." };
    }

    // Verify ownership
    const [existingPost] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
    if (!existingPost) {
      return { success: false, error: "Post not found" };
    }

    if (existingPost.authorId !== session.user.id && session.user.role !== "admin") {
      return { success: false, error: "Forbidden: You do not own this post." };
    }

    // Only update slug if it was a draft and title changed
    let slug = existingPost.slug;
    if (existingPost.status === "draft" && existingPost.title !== title) {
      slug = await getUniqueSlug(title, postId);
    }

    await db
      .update(posts)
      .set({
        title,
        slug,
        content,
        summary: summary || title.substring(0, 150),
        coverImage: coverImage || null,
        projectId: projectId || null,
        tags: tags || [],
        seoTitle: seoTitle || title,
        seoDescription: seoDescription || summary || title.substring(0, 150),
        updatedAt: new Date(),
        // Reset rejection status if edited
        status: existingPost.status === "rejected" ? "draft" : existingPost.status,
        rejectionReason: existingPost.status === "rejected" ? null : existingPost.rejectionReason,
      })
      .where(eq(posts.id, postId));

    revalidatePath("/profile");
    revalidatePath(`/blog/${slug}`);
    return { success: true, slug };
  } catch (err: any) {
    console.error("Error updating post:", err);
    return { success: false, error: err.message || "Failed to update post" };
  }
}

// 3. Submit post for Admin review
export async function actionSubmitPost(postId: string) {
  const session = await getSession();
  if (!session || !session.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const [existingPost] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
    if (!existingPost) {
      return { success: false, error: "Post not found" };
    }

    if (existingPost.authorId !== session.user.id) {
      return { success: false, error: "Forbidden" };
    }

    if (existingPost.status !== "draft" && existingPost.status !== "rejected") {
      return { success: false, error: "Only drafts or rejected posts can be submitted for review." };
    }

    await db
      .update(posts)
      .set({
        status: "pending",
        updatedAt: new Date(),
      })
      .where(eq(posts.id, postId));

    revalidatePath("/profile");
    return { success: true };
  } catch (err: any) {
    console.error("Error submitting post:", err);
    return { success: false, error: err.message || "Failed to submit post" };
  }
}

// 4. Delete a post
export async function actionDeletePost(postId: string) {
  const session = await getSession();
  if (!session || !session.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const [existingPost] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
    if (!existingPost) {
      return { success: false, error: "Post not found" };
    }

    if (existingPost.authorId !== session.user.id && session.user.role !== "admin") {
      return { success: false, error: "Forbidden" };
    }

    await db.delete(posts).where(eq(posts.id, postId));

    revalidatePath("/profile");
    revalidatePath("/blog");
    return { success: true };
  } catch (err: any) {
    console.error("Error deleting post:", err);
    return { success: false, error: err.message || "Failed to delete post" };
  }
}

// 5. Admin Approve Post
export async function actionApprovePost(postId: string) {
  const session = await getSession();
  if (!session || !session.user || session.user.role !== "admin") {
    return { success: false, error: "Forbidden: Admin access required." };
  }

  try {
    const [existingPost] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
    if (!existingPost) {
      return { success: false, error: "Post not found" };
    }

    await db
      .update(posts)
      .set({
        status: "published",
        publishedAt: new Date(),
        updatedAt: new Date(),
        rejectionReason: null,
      })
      .where(eq(posts.id, postId));

    revalidatePath("/blog");
    revalidatePath(`/blog/${existingPost.slug}`);
    revalidatePath("/admin/blog");
    return { success: true };
  } catch (err: any) {
    console.error("Error approving post:", err);
    return { success: false, error: err.message || "Failed to approve post" };
  }
}

// 6. Admin Reject Post
export async function actionRejectPost(postId: string, reason: string) {
  const session = await getSession();
  if (!session || !session.user || session.user.role !== "admin") {
    return { success: false, error: "Forbidden: Admin access required." };
  }

  try {
    const [existingPost] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
    if (!existingPost) {
      return { success: false, error: "Post not found" };
    }

    await db
      .update(posts)
      .set({
        status: "rejected",
        rejectionReason: reason || "No reason provided",
        updatedAt: new Date(),
      })
      .where(eq(posts.id, postId));

    revalidatePath("/profile");
    revalidatePath("/admin/blog");
    return { success: true };
  } catch (err: any) {
    console.error("Error rejecting post:", err);
    return { success: false, error: err.message || "Failed to reject post" };
  }
}
