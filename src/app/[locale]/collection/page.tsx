import { actionGetRecentCollections } from "@/app/actions";
import { Link } from "@/i18n/routing";
import { FolderHeart, Calendar, ArrowRight, Layers, Sparkles, AlertCircle } from "lucide-react";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function CollectionsPage({ params }: PageProps) {
  const { locale } = await params;
  const isVi = locale === "vi";
  const collections = await actionGetRecentCollections(20);

  return (
    <div className="w-full bg-[var(--color-canvas)] min-h-screen pb-16">
      {/* Hero Section */}
      <section className="apple-tile-light w-full pt-12 pb-14 border-b border-[var(--color-divider-soft)]">
        <div className="page-container max-w-4xl mx-auto px-4 text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-action-blue)] bg-[var(--color-action-blue)]/10 border border-[var(--color-action-blue)]/20 px-3 py-1 rounded-full">
            <FolderHeart className="w-3.5 h-3.5" />
            {isVi ? "Cộng đồng tuyển chọn" : "Curated by Community"}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[var(--color-ink)]">
            {isVi ? "Bộ sưu tập Mã nguồn mở" : "Open Source Collections"}
          </h1>
          <p className="text-[16px] text-[var(--color-text-secondary)] leading-relaxed max-w-xl mx-auto">
            {isVi 
              ? "Khám phá các danh sách tuyển chọn dự án thịnh hành hàng đầu (Top 3, 5, 10) từ cộng đồng lập trình viên."
              : "Discover curated lists of top trending projects (Top 3, 5, 10) handpicked by the developer community."}
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="page-container max-w-4xl mx-auto px-4 mt-12">
        {collections.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-3xl bg-[var(--color-canvas-parchment)] border border-[var(--color-divider-soft)] max-w-md mx-auto space-y-4">
            <AlertCircle className="w-10 h-10 text-[var(--color-ink-muted-48)] mx-auto" />
            <h3 className="text-base font-bold text-[var(--color-ink)]">
              {isVi ? "Chưa có bộ sưu tập nào" : "No collections yet"}
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              {isVi 
                ? "Hãy là người đầu tiên tạo bộ sưu tập! Nhấp vào nút '+ So sánh' trên bảng xếp hạng để thu thập các dự án và bắt đầu tuyển chọn."
                : "Be the first to curate a collection! Click '+ Compare' on the leaderboard to select projects and start curating."}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[var(--color-action-blue)] hover:bg-[var(--color-accent-hover)] px-4 py-2 rounded-xl transition-all shadow-md cursor-pointer animate-pulse"
            >
              {isVi ? "Xem bảng xếp hạng" : "Go to Leaderboard"}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {collections.map((col) => {
              const dateStr = new Date(col.createdAt).toLocaleDateString(isVi ? "vi-VN" : "en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              });

              return (
                <Link
                  key={col.id}
                  href={`/collection/${col.slug}`}
                  className="glass-card hover-spring group relative p-6 border border-[var(--color-divider-soft)] hover:border-[var(--color-border-hover)] rounded-2xl flex flex-col justify-between h-56 cursor-pointer"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-[var(--color-ink-muted-80)]">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {dateStr}
                      </span>
                      <span className="flex items-center gap-1 uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        <Sparkles className="w-3 h-3" />
                        Curated
                      </span>
                    </div>

                    <h3 className="text-[17px] font-bold text-[var(--color-ink)] group-hover:text-[var(--color-accent)] transition-colors line-clamp-1 leading-snug">
                      {col.title}
                    </h3>

                    {col.description && (
                      <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed break-words">
                        {col.description}
                      </p>
                    )}
                  </div>

                  {/* Project Previews */}
                  <div className="flex items-center justify-between pt-4 border-t border-[var(--color-divider-soft)]">
                    <div className="flex items-center">
                      <div className="flex -space-x-2.5 overflow-hidden">
                        {col.projectPreviews.map((p, idx) =>
                          p.avatarUrl ? (
                            <img
                              key={idx}
                              src={p.avatarUrl}
                              alt={p.fullName}
                              title={p.fullName}
                              className="inline-block h-7 w-7 rounded-md object-cover ring-2 ring-white dark:ring-[#1C1C1E] bg-white border border-[var(--color-border)] shrink-0"
                            />
                          ) : (
                            <div
                              key={idx}
                              title={p.fullName}
                              className="inline-block h-7 w-7 rounded-md ring-2 ring-white dark:ring-[#1C1C1E] bg-zinc-100 dark:bg-zinc-800 border border-[var(--color-border)] shrink-0 flex items-center justify-center text-[9px] font-bold text-[var(--color-ink-muted-48)]"
                            >
                              {(p.fullName || "?").charAt(0).toUpperCase()}
                            </div>
                          )
                        )}
                      </div>
                      <span className="text-[11px] text-[var(--color-text-tertiary)] ml-2.5 font-medium flex items-center gap-1 select-none">
                        <Layers className="w-3.5 h-3.5" />
                        {isVi ? "Xem chi tiết" : "View collection"}
                      </span>
                    </div>

                    <div className="h-7 w-7 rounded-full bg-[var(--color-surface-pearl)] text-[var(--color-ink-muted-80)] group-hover:text-[var(--color-action-blue)] group-hover:bg-[var(--color-action-blue)]/10 flex items-center justify-center transition-all">
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Action Guide CTA */}
        {collections.length > 0 && (
          <div className="mt-16 text-center space-y-4 max-w-lg mx-auto py-8 px-6 border-t border-[var(--color-divider-soft)]">
            <h4 className="text-sm font-bold text-[var(--color-ink)]">
              {isVi ? "Muốn tự tạo bộ sưu tập của riêng bạn?" : "Want to curate your own collection?"}
            </h4>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              {isVi 
                ? "Thật dễ dàng! Chỉ cần bấm nút '+ So sánh' bên cạnh bất kỳ dự án nào trên trang chủ. Bạn có thể chọn tới 10 dự án, sắp xếp thứ tự và viết cảm nghĩ trước khi xuất bản."
                : "It's simple! Just click the '+ Compare' button next to any project on the homepage. You can select up to 10 projects, rearrange them, and write notes before publishing."}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-action-blue)] hover:underline"
            >
              {isVi ? "Bắt đầu tạo ngay trên Trang chủ" : "Start curating on Homepage"}
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
