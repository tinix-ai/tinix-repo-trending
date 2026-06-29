"use client";

import { useState, useEffect } from "react";
import { Trash2, Users, Shield, User as UserIcon, ShieldAlert, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { timeAgo } from "@/lib/utils";

interface UserData {
  id: string;
  username: string;
  role: string;
  createdAt: string;
}

export function UsersManager() {
  const [usersList, setUsersList] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users`);
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.users || []);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateRole = async (id: string, newRole: string) => {
    if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;

    setActionLoading(id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role: newRole }),
      });
      if (res.ok) {
        setUsersList((prev) => 
          prev.map((u) => u.id === id ? { ...u, role: newRole } : u)
        );
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update role");
      }
    } catch (error) {
      console.error("Failed to update user role:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user permanently? This will also delete their reviews and votes.")) return;
    
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/users?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setUsersList((prev) => prev.filter((u) => u.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete user");
      }
    } catch (error) {
      console.error("Failed to delete user:", error);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--color-ink)]">Users Management</h2>
            <p className="text-sm text-[var(--color-ink-muted-80)]">Manage registered members</p>
          </div>
        </div>
        <div className="text-sm text-[var(--color-ink-muted-80)] bg-[var(--color-bg-secondary)] px-4 py-2 rounded-xl border border-[var(--color-divider-soft)]">
          Total Users: <span className="font-bold text-[var(--color-ink)]">{usersList.length}</span>
        </div>
      </div>

      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="w-8 h-8 border-2 border-[var(--color-action-blue)]/30 border-t-[var(--color-action-blue)] rounded-full animate-spin" />
          </div>
        ) : usersList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            <ShieldAlert className="w-10 h-10 text-[var(--color-ink-muted-48)] mb-3" />
            <h3 className="text-sm font-bold text-[var(--color-ink)] mb-1">No users found</h3>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-divider-soft)]">
            {usersList.map((user) => (
              <div key={user.id} className="p-6 hover:bg-[var(--color-canvas)]/30 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  
                  {/* Left: Content */}
                  <div className="flex-1 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[var(--color-divider-soft)] flex items-center justify-center text-[var(--color-ink-muted-80)]">
                      {user.role === "admin" ? <Shield className="w-6 h-6 text-emerald-500" /> : <UserIcon className="w-6 h-6" />}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[var(--color-ink)]">@{user.username}</span>
                        {user.role === "admin" && (
                          <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--color-ink-muted-48)] font-medium">
                        Joined {timeAgo(user.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {user.role === "user" ? (
                      <button
                        onClick={() => handleUpdateRole(user.id, "admin")}
                        disabled={actionLoading === user.id}
                        className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <ArrowUpCircle className="w-4 h-4" /> Make Admin
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateRole(user.id, "user")}
                        disabled={actionLoading === user.id}
                        className="flex items-center gap-1.5 px-3 py-2 bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <ArrowDownCircle className="w-4 h-4" /> Demote
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(user.id)}
                      disabled={actionLoading === user.id}
                      className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
