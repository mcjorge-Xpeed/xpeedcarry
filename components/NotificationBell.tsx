"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  type: string;
  order_id: string | null;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};

function linkFor(n: Notification) {
  if (n.type === "order_offer") return `/pro/orders/${n.order_id}`;
  return `/admin/orders/${n.order_id}`;
}

export default function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        const rows = (data as Notification[]) ?? [];
        setNotifications(rows);
        setUnreadCount(rows.filter((n) => !n.read).length);
      });

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as Notification;
          setNotifications((prev) => [n, ...prev].slice(0, 20));
          setUnreadCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  async function toggleOpen() {
    const opening = !open;
    setOpen(opening);
    if (opening && unreadCount > 0) {
      setUnreadCount(0);
      await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={toggleOpen}
        className="relative w-9 h-9 rounded-full bg-[#121018] border border-white/10 hover:border-accent transition flex items-center justify-center"
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 card p-2 text-sm shadow-xl max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-3 py-4 text-gray-400 text-xs text-center">No notifications yet.</p>
          ) : (
            notifications.map((n) => (
              <Link
                key={n.id}
                href={linkFor(n)}
                onClick={() => setOpen(false)}
                className="block px-3 py-2 rounded hover:bg-white/5"
              >
                <p className="font-semibold text-xs text-accent">{n.title}</p>
                <p className="text-xs text-gray-400 truncate">{n.body}</p>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
