"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const CEO_ADMIN_ID = "0b29152f-5c04-4067-bd33-50d39b0c79cd";
const ROLE_ORDER = ["client", "support", "pro", "admin"] as const;
const ROLE_LABELS: Record<string, string> = {
  client: "Clientes",
  support: "Support",
  pro: "Pros",
  admin: "Admins",
};

export default function AdminUsersPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [visibleRoles, setVisibleRoles] = useState<Record<string, boolean>>({
    client: true,
    support: true,
    pro: true,
    admin: true,
  });

  useEffect(() => {
    const role = new URLSearchParams(window.location.search).get("role");
    if (role && ROLE_ORDER.includes(role as any)) {
      setVisibleRoles({ client: false, support: false, pro: false, admin: false, [role]: true });
    }
  }, []);
  const [warningsByPro, setWarningsByPro] = useState<Record<string, any[]>>({});
  const [expandedWarnings, setExpandedWarnings] = useState<Record<string, boolean>>({});
  const [lockClicks, setLockClicks] = useState(0);
  const [showEasterEgg, setShowEasterEgg] = useState(false);
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
      .order("created_at", { ascending: false });
    setProfiles(data ?? []);

    const { data: warnings } = await supabase
      .from("pro_warnings")
      .select("*")
      .order("created_at", { ascending: false });
    const byPro: Record<string, any[]> = {};
    for (const w of warnings ?? []) {
      if (!byPro[w.pro_id]) byPro[w.pro_id] = [];
      byPro[w.pro_id].push(w);
    }
    setWarningsByPro(byPro);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleSuspend(id: string, currentlyActive: boolean) {
    await supabase.from("profiles").update({ active: !currentlyActive }).eq("id", id);
    load();
  }

  async function changeRole(id: string, newRole: string) {
    await supabase.from("profiles").update({ role: newRole }).eq("id", id);
    load();
  }

  async function toggleHousePro(id: string, currentlyHouse: boolean) {
    await supabase.from("profiles").update({ is_house_pro: !currentlyHouse }).eq("id", id);
    load();
  }

  function handleLockClick() {
    const next = lockClicks + 1;
    if (next >= 10) {
      setShowEasterEgg(true);
      setLockClicks(0);
    } else {
      setLockClicks(next);
    }
  }

  function toggleColumn(role: string) {
    setVisibleRoles((prev) => ({ ...prev, [role]: !prev[role] }));
  }

  if (loading) return <p className="text-center mt-20">Loading...</p>;

  if (isAdmin === false) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <p>You don't have admin permissions.</p>
      </div>
    );
  }

  const shownRoles = ROLE_ORDER.filter((r) => visibleRoles[r]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold mb-2">Users</h1>
      <p className="text-gray-400 text-sm mb-6">
        Change a user's role, or suspend a client/pro/support who breaks the rules. Suspended accounts lose all access to the site until you reactivate them.
      </p>

      <div className="flex gap-2 mb-6 flex-wrap">
        {ROLE_ORDER.map((r) => {
          const count = profiles.filter((p) => p.role === r).length;
          const on = visibleRoles[r];
          return (
            <button
              key={r}
              onClick={() => toggleColumn(r)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                on ? "border-accent text-accent bg-accent/10" : "border-white/10 text-gray-500"
              }`}
            >
              {on ? "✓ " : ""}
              {ROLE_LABELS[r]} ({count})
            </button>
          );
        })}
      </div>

      {shownRoles.length === 0 ? (
        <p className="text-gray-500 text-sm">Selecciona al menos una columna para mostrar.</p>
      ) : (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${shownRoles.length}, minmax(0, 1fr))` }}
        >
          {shownRoles.map((r) => {
            const roleProfiles = profiles.filter((p) => p.role === r);
            return (
              <div key={r} className="card p-4 min-w-0">
                <h2 className="font-semibold mb-3">{ROLE_LABELS[r]}</h2>
                <div className="flex flex-col gap-3">
                  {roleProfiles.length === 0 && (
                    <p className="text-xs text-gray-500">No users yet.</p>
                  )}
                  {roleProfiles.map((p) => (
                    <div key={p.id} className="border border-white/10 rounded-lg p-3">
                      <p className="font-medium text-sm truncate">{p.full_name ?? "-"}</p>
                      {p.id === CEO_ADMIN_ID ? (
                        <div className="mt-2">
                          <button
                            onClick={handleLockClick}
                            className="w-full text-xs px-2 py-1.5 rounded border border-accent/40 text-accent bg-accent/5"
                          >
                            🛡️ Don't Touch This One
                          </button>
                          {showEasterEgg && (
                            <p className="text-xs text-yellow-400 mt-1 text-center">
                              🛡️ Nice try. This account is untouchable — even the database says no. — The CEO
                            </p>
                          )}
                        </div>
                      ) : (
                        <>
                          <select
                            value={p.role}
                            onChange={(e) => changeRole(p.id, e.target.value)}
                            className="input py-1 px-2 text-xs w-full mt-2 capitalize"
                          >
                            <option value="client">Client</option>
                            <option value="support">Support</option>
                            <option value="pro">Pro</option>
                            <option value="admin">Admin</option>
                          </select>
                          <div className="flex items-center justify-between mt-2">
                            <span className={`text-xs ${p.active ? "text-accent2" : "text-red-400"}`}>
                              {p.active ? "Active" : "Suspended"}
                            </span>
                            <button
                              className={`text-xs hover:underline ${p.active ? "text-red-400" : "text-accent2"}`}
                              onClick={() => toggleSuspend(p.id, p.active)}
                            >
                              {p.active ? "Suspend" : "Reactivate"}
                            </button>
                          </div>
                        </>
                      )}
                      {r === "pro" && (
                        <button
                          onClick={() => toggleHousePro(p.id, !!p.is_house_pro)}
                          className={`mt-2 w-full text-xs px-2 py-1 rounded border transition ${
                            p.is_house_pro
                              ? "border-accent text-accent bg-accent/10"
                              : "border-white/10 text-gray-500"
                          }`}
                        >
                          {p.is_house_pro ? "🏠 De casa (40% neto)" : "Normal (30% neto)"}
                        </button>
                      )}
                      {r === "pro" && p.under_investigation && (
                        <p className="text-xs text-blue-300 mt-1">🔍 Under investigation</p>
                      )}
                      {r === "pro" && p.permanently_banned && (
                        <p className="text-xs text-red-400 mt-1">🚫 Permanently banned</p>
                      )}
                      {r === "pro" && p.penalty_orders_remaining > 0 && (
                        <p className="text-xs text-yellow-400 mt-1">⚠ Reduced rate ({p.penalty_orders_remaining} order(s) left)</p>
                      )}
                      {r === "pro" && (() => {
                        const warnings = warningsByPro[p.id] ?? [];
                        const yellowCount = warnings.filter((w) => w.type === "yellow").length;
                        const redCount = warnings.filter((w) => w.type === "red").length;
                        const expanded = expandedWarnings[p.id];
                        if (warnings.length === 0) {
                          return <p className="text-xs text-gray-500 mt-2">No warnings.</p>;
                        }
                        return (
                          <div className="mt-2">
                            <button
                              onClick={() => setExpandedWarnings((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                              className="text-xs text-gray-400 hover:underline"
                            >
                              {yellowCount > 0 && `🟡 ${yellowCount}`} {redCount > 0 && `🔴 ${redCount}`} {expanded ? "▲" : "▼"}
                            </button>
                            {expanded && (
                              <ul className="mt-1 flex flex-col gap-1">
                                {warnings.map((w) => (
                                  <li key={w.id} className="text-xs text-gray-500 border-t border-white/5 pt-1">
                                    {w.type === "yellow" ? "🟡" : "🔴"} {w.category}
                                    {w.note && `: ${w.note}`}
                                    <br />
                                    <span className="text-gray-600">{new Date(w.created_at).toLocaleDateString()}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
