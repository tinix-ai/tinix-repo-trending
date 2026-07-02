import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { actionGetUserProjects, actionGetUserReviews, actionGetUserVotes } from "@/app/actions";
import { getSession } from "@/lib/auth";
import { getUserById } from "@/lib/db/queries";
import { getUserPosts } from "@/lib/db/blog-queries";
import { redirect } from "next/navigation";
import { ProfileTabs } from "@/components/profile/profile-tabs";

export default async function ProfilePage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const { locale } = params;
  const t = await getTranslations(); 
  
  const session = await getSession();
  if (!session?.userId) {
    redirect(`/${locale}/login`);
  }

  const [user, projectsRes, reviewsRes, votesRes, posts] = await Promise.all([
    getUserById(session.userId),
    actionGetUserProjects(),
    actionGetUserReviews(),
    actionGetUserVotes(),
    getUserPosts(session.userId)
  ]);

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const projects = projectsRes.success ? (projectsRes.projects || []) : [];
  const reviews = reviewsRes.success ? (reviewsRes.reviews || []) : [];
  const votes = votesRes.success ? (votesRes.votes || []) : [];

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
      <PageHeader
        title={t("Profile.title")}
        subtitle={t("Profile.subtitle")}
      />
      
      <ProfileTabs 
        user={{ username: user.username, role: user.role, createdAt: (user.createdAt as Date).toISOString() }} 
        projects={projects} 
        reviews={reviews} 
        votes={votes}
        posts={posts.map(p => ({
          ...p,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null
        }))}
        locale={locale} 
      />
    </div>
  );
}

