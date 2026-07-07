import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { Link } from "react-router-dom";
import { Check, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [stale, setStale] = useState({ leads: [], threshold_days: 2 });

  const load = async () => {
    const [t, s] = await Promise.all([api.get("/tasks", { params: { status: "pending" } }), api.get("/leads/stale/list")]);
    setTasks(t.data); setStale(s.data);
  };
  useEffect(() => { load(); }, []);

  const complete = async (t) => { await api.patch(`/tasks/${t.id}`, { status: "done" }); load(); };

  return (
    <Layout title="My Tasks & Alerts" subtitle="Pending tasks and leads that haven't been touched recently.">
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
