"use client";

import { useEffect, useState } from "react";
import { fetchAdminAchievementsStats, fetchAdminAchievementsList } from "@/app/actions";
import { Trophy, Activity, GitCommit, Box, Calendar, Award, ExternalLink } from "lucide-react";
import { Link } from "@/i18n/routing";

export function AchievementsManager() {
  const [stats, setStats] = useState<any>(null);
  const [list, setList] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const limit = 20;

  useEffect(() => {
    loadData();
  }, [page]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const offset = (page - 1) * limit;
      const [statsRes, listRes] = await Promise.all([
        fetchAdminAchievementsStats(),
        fetchAdminAchievementsList(limit, offset)
      ]);

      if (statsRes.success && statsRes.stats) setStats(statsRes.stats);
      else setError(statsRes.error || "Failed to load stats");

      if (listRes.success && listRes.list) {
        setList(listRes.list);
        setTotalCount(listRes.total || 0);
      }
      else setError(listRes.error || "Failed to load list");

    } catch (e) {
      console.error(e);
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  const getBadgeIcon = (type: string) => {
    switch (type) {
      case 'github_stars':
        return <Activity className="w-4 h-4 text-orange-500" />;
      case 'huggingface_downloads':
        return <Box className="w-4 h-4 text-blue-500" />;
      default:
        return <Trophy className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getSourceIcon = (source: string | null) => {
    if (source === 'github') return <GitCommit className="w-3.5 h-3.5" />;
    if (source === 'huggingface') return <Box className="w-3.5 h-3.5" />;
    return <Box className="w-3.5 h-3.5" />;
  };

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
        <p className="font-medium">Error loading achievements</p>
        <p className="text-sm">{error}</p>
        <button onClick={loadData} className="mt-2 text-sm font-semibold underline">Retry</button>
      </div>
    );
  }

  const totalPages = Math.ceil(totalCount / limit) || 1;

  return (
    <div className="space-y-6">
      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[var(--color-divider)] rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2 text-[var(--color-ink-muted)]">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">Total Awards</h3>
          </div>
          <p className="text-3xl font-bold text-[var(--color-ink)]">{stats?.total || 0}</p>
        </div>

        <div className="bg-white border border-[var(--color-divider)] rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2 text-[var(--color-ink-muted)]">
            <Calendar className="w-4 h-4 text-green-500" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">Last 7 Days</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">+{stats?.recentCount || 0}</p>
        </div>

        <div className="bg-white border border-[var(--color-divider)] rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2 text-[var(--color-ink-muted)]">
            <GitCommit className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">GitHub</h3>
          </div>
          <p className="text-3xl font-bold text-[var(--color-ink)]">{stats?.githubTotal || 0}</p>
        </div>

        <div className="bg-white border border-[var(--color-divider)] rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2 text-[var(--color-ink-muted)]">
            <Box className="w-4 h-4 text-yellow-600" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">HuggingFace</h3>
          </div>
          <p className="text-3xl font-bold text-[var(--color-ink)]">{stats?.hfTotal || 0}</p>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-[var(--color-divider)] rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-[var(--color-divider)] flex justify-between items-center bg-[#F8FAFC]">
          <h3 className="font-semibold text-[var(--color-ink)] flex items-center gap-2">
            <Award className="w-4 h-4 text-blue-500" />
            Achievement Ledger
          </h3>
          <span className="text-xs text-[var(--color-ink-muted)] font-medium bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full border border-blue-100">
            Total {totalCount} records
          </span>
        </div>

        <div className="overflow-x-auto relative min-h-[300px]">
          {loading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10">
              <div className="flex items-center gap-2 px-4 py-2 bg-white border border-[var(--color-divider)] rounded-full shadow-sm text-sm font-medium text-[var(--color-ink-muted)]">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                Loading...
              </div>
            </div>
          )}
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[var(--color-divider)]">
                <th className="py-3 px-5 text-xs font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider whitespace-nowrap">Project</th>
                <th className="py-3 px-5 text-xs font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider whitespace-nowrap">Achievement</th>
                <th className="py-3 px-5 text-xs font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider whitespace-nowrap">Rank</th>
                <th className="py-3 px-5 text-xs font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider whitespace-nowrap">Scope</th>
                <th className="py-3 px-5 text-xs font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider whitespace-nowrap text-right">Awarded Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-divider-soft)]">
              {list.map((item) => (
                <tr key={item.id} className="hover:bg-blue-50/50 transition-colors duration-150">
                  <td className="py-3 px-5 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-md bg-gray-100 text-gray-500">
                        {getSourceIcon(item.projectSource)}
                      </div>
                      <div className="flex flex-col">
                        <Link href={`/project/${item.projectId}`} className="font-medium text-sm text-[var(--color-ink)] hover:text-blue-600 transition-colors flex items-center gap-1 group">
                          {item.projectFullName || item.projectName}
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-5 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getBadgeIcon(item.achievementType)}
                      <span className="text-sm font-medium">{item.achievementType === 'github_stars' ? 'Trending Stars' : item.achievementType === 'huggingface_downloads' ? 'Trending Downloads' : item.achievementType}</span>
                    </div>
                  </td>
                  <td className="py-3 px-5 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        item.rank === 1 ? 'bg-amber-100 text-amber-700' :
                        item.rank === 2 ? 'bg-gray-200 text-gray-700' :
                        item.rank === 3 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        Top {item.rank}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-5 whitespace-nowrap">
                    <span className="text-sm font-medium text-[var(--color-ink-muted)]">
                      {item.scope === 'global' ? '🌍 Global' : `📚 ${item.scope}`} • {item.period === 'daily' ? 'Daily' : item.period === 'weekly' ? 'Weekly' : 'Monthly'}
                    </span>
                  </td>
                  <td className="py-3 px-5 whitespace-nowrap text-right text-sm text-[var(--color-ink-muted)] font-mono">
                    {item.achievedAt ? new Date(item.achievedAt).toLocaleDateString() : 'Unknown'}
                  </td>
                </tr>
              ))}
              
              {!loading && list.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[var(--color-ink-muted)]">
                    <div className="flex flex-col items-center justify-center">
                      <Trophy className="w-12 h-12 text-gray-200 mb-3" />
                      <p>No achievements recorded yet.</p>
                      <p className="text-xs mt-1">Run the daily update job to generate achievements.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-[var(--color-divider)] flex items-center justify-between bg-white">
            <span className="text-sm text-[var(--color-ink-muted)]">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalCount)} of {totalCount} records
            </span>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm font-medium border border-[var(--color-divider)] rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-sm font-medium text-[var(--color-ink)]">
                Page {page} of {totalPages}
              </span>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm font-medium border border-[var(--color-divider)] rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
