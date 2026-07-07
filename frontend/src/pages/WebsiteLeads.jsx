import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { Globe, CheckCircle2, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export default function WebsiteLeads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState("new");

  const load = async () => {
    const { data } = await api.get("/leads", { params: { source: "website" } });
    setLeads(data);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (user?.role === "admin") api.get("/users").then((r) => setUsers(r.data)); }, [user]);

  const filtered = tab === "new" ? leads.filter((l) => !l.reviewed) : leads;

  const assign = async (l, uid) => {
    try {
      await api.patch(`/leads/${l.id}`, { assigned_to: uid === "__none__" ? null : uid });
      toast.success("Assigned");
      load();
    } catch (e) { toast.error("Failed to assign"); }
  };

  const markReviewed = async (l) => {
    try {
      await api.post(`/leads/${l.id}/review`);
      toast.success("Marked as reviewed");
      load();
    } catch (e) { toast.error("Failed"); }
  };

  return (
    <Layout title="Website Leads" subtitle="Incoming leads captured from rayvoyoverseas.com">
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => setTab("new")} data-testid="tab-new" className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${tab === "new" ? "bg-[#C05B43] text-white" : "bg-white border border-stone-200 text-stone-600"}`}>
          New · {leads.filter((l) => !l.reviewed).length}
        </button>
        <button onClick={() => setTab("all")} data-testid="tab-all" className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${tab === "all" ? "bg-[#C05B43] text-white" : "bg-white border border-stone-200 text-stone-600"}`}>
          All · {leads.length}
        </button>
        <Link to="/settings" className="ml-auto text-xs text-[#C05B43] font-semibold inline-flex items-center gap-1 hover:underline">
          <ExternalLink className="w-3.5 h-3.5" /> Webhook Setup
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((l) => (
          <div key={l.id} className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm hover:border-[#C05B43]/40 transition-colors" data-testid={`website-lead-${l.id}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-[#C05B43]/10 text-[#C05B43] grid place-items-center"><Globe className="w-4 h-4" /></div>
                  <div>
                    <Link to={`/lead/${l.id}`} className="font-semibold text-stone-900 hover:text-[#C05B43]">{l.name}</Link>
                    <div className="text-[11px] text-stone-500">{new Date(l.created_at).toLocaleString()}</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-stone-600 grid grid-cols-2 gap-y-1 gap-x-4">
                  <div><span className="text-stone-400">Email:</span> {l.email || "—"}</div>
                  <div><span className="text-stone-400">Phone:</span> {l.phone || "—"}</div>
                  <div><span className="text-stone-400">Country:</span> {l.country_interest || "—"}</div>
                  <div><span className="text-stone-400">Course:</span> {l.course_interest || "—"}</div>
                </div>
                {l.notes && <div className="mt-2 text-xs text-stone-600 bg-stone-50 border border-stone-100 rounded-lg p-2">{l.notes}</div>}
              </div>
              {!l.reviewed && <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#C05B43] text-white rounded-full">New</span>}
            </div>

            <div className="mt-4 flex items-center gap-2 pt-3 border-t border-stone-100">
              {user?.role === "admin" ? (
                <Select value={l.assigned_to || "__none__"} onValueChange={(v) => assign(l, v)}>
                  <SelectTrigger className="h-8 text-xs w-44" data-testid={`assign-${l.id}`}><SelectValue placeholder="Assign counsellor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {users.map((u) => (<SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              ) : <div className="text-xs text-stone-500">{l.assigned_to_name || "Unassigned"}</div>}
              {!l.reviewed && (
                <Button size="sm" variant="outline" onClick={() => markReviewed(l)} data-testid={`reviewed-${l.id}`} className="text-xs h-8">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Reviewed
                </Button>
              )}
              <Link to={`/lead/${l.id}`} className="ml-auto text-xs font-semibold text-[#C05B43] hover:underline">Open →</Link>
              {user?.role === "admin" && (
                <button
                  onClick={async () => { if (window.confirm(`Move ${l.name} to Bin?`)) { await api.delete(`/leads/${l.id}`); toast.success("Moved to Bin"); load(); } }}
                  data-testid={`web-delete-${l.id}`}
                  className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Move to Bin"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 bg-white border border-dashed border-stone-200 rounded-2xl">
            <Globe className="w-8 h-8 mx-auto text-stone-300 mb-2" />
            <div className="text-sm text-stone-500">No website leads {tab === "new" ? "to review" : "yet"}.</div>
            <Link to="/settings" className="text-xs text-[#C05B43] font-semibold mt-2 inline-block hover:underline">Configure webhook to receive leads →</Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
