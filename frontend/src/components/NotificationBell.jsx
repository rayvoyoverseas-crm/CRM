import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "react-router-dom";

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const unread = items.filter((n) => !n.read).length;

  const load = async () => {
    try { const { data } = await api.get("/notifications"); setItems(data); } catch (e) {}
  };
  useEffect(() => { load(); const iv = setInterval(load, 30000); return () => clearInterval(iv); }, []);

  const readAll = async () => { await api.post("/notifications/read-all"); load(); };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button data-testid="notification-bell" className="relative p-2 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors">
          <Bell className="w-4 h-4" />
          {unread > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#C05B43]" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
          <div className="font-display font-semibold text-sm">Notifications</div>
          {unread > 0 && <button onClick={readAll} className="text-[11px] text-[#C05B43] font-semibold">Mark all read</button>}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && <div className="text-xs text-stone-400 text-center py-8">You're all caught up.</div>}
          {items.map((n) => (
            <Link key={n.id} to={n.link || "#"} onClick={() => api.post(`/notifications/${n.id}/read`).then(load)} className={`block px-4 py-3 border-b border-stone-100 hover:bg-stone-50 ${!n.read ? "bg-[#C05B43]/5" : ""}`}>
              <div className="text-xs font-semibold text-stone-800">{n.title}</div>
              <div className="text-[11px] text-stone-600 mt-0.5">{n.body}</div>
              <div className="text-[10px] text-stone-400 mt-1">{new Date(n.created_at).toLocaleString()}</div>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
