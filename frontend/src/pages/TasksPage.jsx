import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import {
  Check,
  Clock,
  AlertTriangle,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TasksPage() {
  const { user } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [stale, setStale] = useState({
    leads: [],
    threshold_days: 2,
  });

  const [googleCalendar, setGoogleCalendar] = useState({
    available: false,
    connected: false,
  });

  const [loadingGoogleCalendar, setLoadingGoogleCalendar] =
    useState(false);

  const [connectingGoogleCalendar, setConnectingGoogleCalendar] =
    useState(false);

  const load = async () => {
    const [t, s] = await Promise.all([api.get("/tasks", { params: { status: "pending" } }), api.get("/leads/stale/list")]);
    setTasks(t.data); setStale(s.data);
  };

  const loadGoogleCalendarStatus = async () => {
    if (user?.role !== "counsellor") {
      return;
    }
  
    try {
      setLoadingGoogleCalendar(true);
  
      const { data } = await api.get(
        "/google/calendar/status"
      );
  
      setGoogleCalendar(data);
    } catch (error) {
      console.error(
        "Unable to load Google Calendar status",
        error
      );
  
      setGoogleCalendar({
        available: true,
        connected: false,
      });
    } finally {
      setLoadingGoogleCalendar(false);
    }
  };
  
  useEffect(() => {
    load();
  
    if (user?.role === "counsellor") {
      loadGoogleCalendarStatus();
    }
  }, [user?.role]);
  const complete = async (t) => { await api.patch(`/tasks/${t.id}`, { status: "done" }); load(); };

  const connectGoogleCalendar = async () => {
    try {
      setConnectingGoogleCalendar(true);
  
      const { data } = await api.get(
        "/google/calendar/connect"
      );
  
      if (!data?.authorization_url) {
        throw new Error(
          "Google authorization URL was not returned."
        );
      }
  
      window.location.href = data.authorization_url;
    } catch (error) {
      console.error(
        "Unable to connect Google Calendar",
        error
      );
  
      alert(
        error?.response?.data?.detail ||
          "Unable to connect Google Calendar."
      );
  
      setConnectingGoogleCalendar(false);
    }
  };

  return (
    <Layout
      title="My Tasks & Alerts"
      subtitle="Pending tasks and leads that haven't been touched recently."
    >
  
      {/* Google Calendar - Counsellor Only */}
      {["counsellor", "team_lead"].includes(user?.role) && (
        <div className="mb-5 bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
  
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 grid place-items-center shrink-0">
                <CalendarDays className="w-5 h-5 text-blue-600" />
              </div>
  
              <div>
                <div className="font-display font-semibold text-stone-900">
                  Google Calendar
                </div>
  
                {loadingGoogleCalendar ? (
                  <div className="text-sm text-stone-500 mt-1">
                    Checking connection...
                  </div>
                ) : googleCalendar.connected ? (
                  <div className="text-sm text-emerald-600 mt-1 font-medium">
                    ✓ Connected
                  </div>
                ) : (
                  <div className="text-sm text-stone-500 mt-1">
                    Connect your Google Calendar to sync CRM
                    tasks and reminders.
                  </div>
                )}
              </div>
            </div>
  
            {!loadingGoogleCalendar &&
              !googleCalendar.connected && (
                <Button
                  type="button"
                  onClick={connectGoogleCalendar}
                  disabled={connectingGoogleCalendar}
                  className="bg-[#1B365D] hover:bg-[#152a4a] rounded-xl"
                >
                  <CalendarDays className="w-4 h-4 mr-2" />
  
                  {connectingGoogleCalendar
                    ? "Connecting..."
                    : "Connect Google Calendar"}
                </Button>
              )}
  
            {!loadingGoogleCalendar &&
              googleCalendar.connected && (
                <div className="px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-700">
                  Calendar Connected
                </div>
              )}
  
          </div>
        </div>
      )}
  
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-stone-200 rounded-2xl p-6">
          <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-[#C05B43]" /> Pending Tasks</h3>
          <div className="space-y-2">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 border border-stone-100 rounded-xl p-3">
                <button onClick={() => complete(t)} className="w-5 h-5 rounded-full border-2 border-stone-300 hover:border-[#C05B43]" />
                <div className="flex-1 min-w-0">
                  <Link to={`/lead/${t.lead_id}`} className="text-sm font-semibold text-stone-800 hover:text-[#C05B43]">{t.title}</Link>
                  <div className="text-[11px] text-stone-500">{t.lead_name} · Due {new Date(t.due_at).toLocaleString()}</div>
                </div>
              </div>
            ))}
            {tasks.length === 0 && <div className="text-sm text-stone-400 text-center py-6">No pending tasks. 🎉</div>}
          </div>
        </div>

        <div className="bg-white border border-rose-200 rounded-2xl p-6">
          <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2 text-rose-700"><AlertTriangle className="w-4 h-4" /> Stale Leads (&gt;{stale.threshold_days} days)</h3>
          <div className="space-y-2">
            {stale.leads.map((l) => (
              <Link key={l.id} to={`/lead/${l.id}`} className="block border border-rose-100 bg-rose-50/50 rounded-xl p-3 hover:border-rose-300">
                <div className="text-sm font-semibold text-stone-800">{l.name}</div>
                <div className="text-[11px] text-stone-500">Last touched {new Date(l.updated_at).toLocaleDateString()} · Stage {l.stage} · {l.assigned_to_name || "Unassigned"}</div>
              </Link>
            ))}
            {stale.leads.length === 0 && <div className="text-sm text-stone-400 text-center py-6">All leads are fresh. 👌</div>}
          </div>
        </div>
      </div>
    </Layout>
  );
}
