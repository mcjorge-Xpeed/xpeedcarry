"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminUsersPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const supabase = createClient();

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
    if (me?.role !== "admin") {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setIsAdmin(true);

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .in("role", ["client", "pro"])
      .order("created_at", { ascending: false });
    setProfiles(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleSuspend(id: string, currentlyActive: boolean) {
    await supabase.from("profiles").update({ active: !currentlyActive }).eq("id", id);
    load();
  }

  if (loading) return <p className="text-center mt-20">Loading...</p>;

  if (isAdmin === false) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <p>You don't have admin permissions.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold mb-2">Users</h1>
      <p className="text-gray-400 text-sm mb-8">
        Suspend a client or pro who breaks the rules — they lose all access to the site until you reactivate them.
      </p>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-400 border-b border-white/10">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-b border-white/5">
                <td className="p-3">{p.full_name ?? "-"}</td>
                <td className="p-3 capitalize">{p.role}</td>
                <td className="p-3">
                  {p.active ? (
                    <span className="text-accent2">Active</span>
                  ) : (
                    <span className="text-red-400">Suspended</span>
                  )}
                </td>
                <td className="p-3">
                  <button
                    className={`text-sm hover:underline ${p.active ? "text-red-400" : "text-accent2"}`}
                    onClick={() => toggleSuspend(p.id, p.active)}
                  >
                    {p.active ? "Suspend" : "Reactivate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
