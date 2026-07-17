import React, { useEffect, useState, useCallback } from "react";
import Layout from "@/components/Layout";
import api, { PIPELINE_STAGES, PIPELINE_LABELS, STAGE_MAP } from "@/lib/api";
import { Link } from "react-router-dom";
import StageBadge, { StageChip } from "@/components/StageBadge";
import { Plus, LayoutGrid, List, Filter, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LeadDialog from "@/components/LeadDialog";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";

function LeadCard({ lead, pipeline, onStageChange, users, onDelete, canDelete }) {
  const stages = PIPELINE_STAGES[pipeline];
  return (
    <div className={`kanban-card ${lead.is_stale ? "!border-rose-400 !bg-rose-50/40" : ""}`} data-testid={`lead-card-${lead.id}`}>
      {lead.is_stale && <div className="text-[10px] uppercase tracking-widest text-rose-600 font-bold mb-1">⚠ Stale · needs update</div>}
      <div className="flex items-start justify-between gap-2">
        <Link to={`/lead/${lead.id}`} className="font-semibold text-[15px] text-stone-900 hover:text-[#C05B43] truncate flex-1">
          {lead.name}
        </Link>
        {canDelete && (
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(lead); }} data-testid={`delete-lead-${lead.id}`} className="p-1 text-stone-300 hover:text-rose-600 shrink-0" title="Move to Bin">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        <StageChip pipeline={pipeline} stage={lead.stage} />
      </div>
      <div className="text-[13px] text-stone-500 mt-1 truncate">{lead.country_interest || "—"} · {lead.course_interest || "TBD"}</div>
      <div className="text-xs text-stone-400 mt-2 truncate">{lead.phone || lead.email || "no contact"}</div>
      <div className="mt-3 flex items-center gap-1.5">
        <Select value={lead.stage} onValueChange={(v) => onStageChange(lead, v)}>
          <SelectTrigger className="h-7 text-[11px] flex-1" data-testid={`stage-change-${lead.id}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {stages.map((s) => (
              <SelectItem key={s} value={s}>{s} · {STAGE_MAP[pipeline][s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {lead.assigned_to_name && (
        <div className="mt-2 text-[10px] text-stone-500 flex items-center gap-1">
          <span className="w-4 h-4 rounded-full bg-[#1B365D] text-white grid place-items-center text-[8px] font-bold">
            {lead.assigned_to_name.slice(0, 1).toUpperCase()}
          </span>
          {lead.assigned_to_name}
        </div>
      )}
    </div>
  );
}

export default function PipelineBoard({ pipeline }) {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [view, setView] = useState("kanban");
  const [openNew, setOpenNew] = useState(false);
  const [users, setUsers] = useState([]);
  const [filterAssignee, setFilterAssignee] = useState("__all__");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [stats, setStats] = useState(null);
  const [searchType, setSearchType] = useState("name");
  const [searchTerm, setSearchTerm] = useState("");
  const stages = PIPELINE_STAGES[pipeline];

  const load = useCallback(async () => {
    const params = { pipeline };
    if (filterAssignee !== "__all__") params.assigned_to = filterAssignee;
    if (dateFrom) params.date_from = new Date(dateFrom).toISOString();
    if (dateTo) params.date_to = new Date(dateTo + "T23:59:59").toISOString();
    const { data } = await api.get("/leads", { params });
    setLeads(data);
  }, [pipeline, filterAssignee, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get("/pipeline/stats").then((r) => setStats(r.data)).catch(() => {}); }, [leads.length]);
  useEffect(() => { if (user?.role === "admin" || user?.permissions?.see_team) api.get("/users").then((r) => setUsers(r.data)).catch(() => {}); }, [user]);

  const onStageChange = async (lead, newStage) => {
    try {
      await api.patch(`/leads/${lead.id}`, { stage: newStage });
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, stage: newStage } : l)));
      toast.success(`Moved to ${STAGE_MAP[pipeline][newStage].label}`);
    } catch (e) {
      toast.error("Failed to update stage");
    }
  };

  const onDelete = async (lead) => {
    if (!window.confirm(`Move ${lead.name} to Bin?`)) return;
    try {
      await api.delete(`/leads/${lead.id}`);
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      toast.success("Moved to Bin");
    } catch (e) { toast.error("Failed to delete"); }
  };

  const onAssignChange = async (lead, newAssignee) => {
    try {
      const body = { assigned_to: newAssignee === "__none__" ? null : newAssignee };
      const { data } = await api.patch(`/leads/${lead.id}`, body);
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? data : l)));
      toast.success("Assignment updated");
    } catch (e) { toast.error("Failed to reassign"); }
  };

   const filteredLeads = leads.filter((lead) => {
  const term = searchTerm.trim().toLowerCase();

  if (!term) return true;

  if (searchType === "phone") {
    const enteredPhone = searchTerm.replace(/\D/g, "");
    const leadPhone = String(lead.phone || "").replace(/\D/g, "");
    return leadPhone.includes(enteredPhone);
  }

  return String(lead.name || "")
    .toLowerCase()
    .includes(term);
});

const grouped = stages.reduce(
  (acc, s) => ({
    ...acc,
    [s]: filteredLeads.filter((l) => l.stage === s),
  }),
  {}
);

  return (
    <Layout
      title={PIPELINE_LABELS[pipeline]}
      subtitle={
        pipeline === "study_abroad" && stats ? (
          <span className="flex flex-wrap items-center gap-3 text-xs mt-1">
            <span className="font-semibold text-stone-700" data-testid="stats-total">Total: <span className="text-[#C05B43]">{stats.total}</span></span>
            <span className="text-stone-300">·</span>
            <span data-testid="stats-pipeline">Pipeline: <b>{stats.in_pipeline}</b></span>
            <span className="text-stone-300">·</span>
            <span>Deposit: <b>{stats.deposit}</b></span>
            <span className="text-stone-300">·</span>
            <span>Visa: <b>{stats.visa}</b></span>
            <span className="text-stone-300">·</span>
            <span>Enrollment: <b>{stats.enrollment}</b></span>
            <span className="text-stone-300">·</span>
            <span>Accommodation: <b>{stats.accommodation}</b></span>
            <span className="text-stone-300">·</span>
            <span>Loan: <b>{stats.loan}</b></span>
          </span>
        ) : `${leads.length} leads · ${stages.length} stages`
      }
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          
         <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-[#A64D37] bg-[#F3E9E4] shadow-xl">
  <Select
    value={searchType}
    onValueChange={(value) => {
      setSearchType(value);
      setSearchTerm("");
    }}
  >
     <SelectTrigger className="h-11 w-36 rounded-xl border-2 border-[#A64D37] bg-white text-sm font-semibold shadow">
      <SelectValue />
    </SelectTrigger>

    <SelectContent>
      <SelectItem value="name">Name</SelectItem>
      <SelectItem value="phone">Phone No.</SelectItem>
    </SelectContent>
  </Select>

  <div className="relative">
    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8B5E4F]" />

    <Input
      value={searchTerm}
      type={searchType === "phone" ? "tel" : "text"}
      inputMode={searchType === "phone" ? "numeric" : "text"}
      onChange={(e) => {
        const value = e.target.value;

        if (searchType === "phone") {
          setSearchTerm(value.replace(/[^\d+\-\s()]/g, ""));
        } else {
          setSearchTerm(value);
        }
      }}
      placeholder={
        searchType === "phone"
          ? "Search phone"
          : "Search name"
      }
      className="h-11 w-72 rounded-xl border-2 border-[#A64D37] bg-white pl-11 text-sm font-medium shadow placeholder:text-stone-500"
    />
  </div>
</div>

          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} data-testid="date-from" className="h-9 text-xs border border-stone-200 rounded-lg px-2 bg-white" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} data-testid="date-to" className="h-9 text-xs border border-stone-200 rounded-lg px-2 bg-white" />
          {(user?.role === "admin" || user?.permissions?.see_team) && (
            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="h-9 w-44 text-xs" data-testid="filter-assignee">
                <Filter className="w-3.5 h-3.5 mr-1" /><SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Counsellors</SelectItem>
                {users.map((u) => (<SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>))}
              </SelectContent>
            </Select>
          )}
          <div className="bg-white border border-stone-200 rounded-lg p-0.5 flex">
            <button data-testid="view-kanban" onClick={() => setView("kanban")} className={`px-2.5 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors ${view === "kanban" ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-800"}`}>
              <LayoutGrid className="w-3.5 h-3.5" /> Board
            </button>
            <button data-testid="view-list" onClick={() => setView("list")} className={`px-2.5 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors ${view === "list" ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-800"}`}>
              <List className="w-3.5 h-3.5" /> List
            </button>
          </div>
          <Button onClick={() => setOpenNew(true)} data-testid="new-lead-button" className="bg-[#C05B43] hover:bg-[#A64D37] rounded-xl">
            <Plus className="w-4 h-4 mr-1" /> New Lead
          </Button>
        </div>
      }
    >
      {view === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((s) => {
            const cfg = STAGE_MAP[pipeline][s];
            return (
              <div key={s} className="kanban-column" data-testid={`column-${s}`}>
                <div className={`flex items-center justify-between mb-3 px-3 py-2.5 rounded-xl ring-1 ring-inset ${cfg.classes}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-base tracking-wide">{s}</span>
                    <span className="opacity-70">·</span>
                    <span className="text-sm font-semibold">{cfg.label}</span>
                  </div>
                  <span className="text-sm font-bold px-2 py-0.5 rounded-full bg-white/60">{grouped[s].length}</span>
                </div>
                {grouped[s].map((l) => (
                  <LeadCard key={l.id} lead={l} pipeline={pipeline} onStageChange={onStageChange} users={users} onDelete={onDelete} canDelete={user?.role === "admin"} />
                ))}

                {grouped[s].length === 0 && (
  <div className="text-[11px] text-stone-400 text-center py-4">
    {searchTerm ? "No matching leads" : "Empty"}
  </div>
)}    
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-stone-500 font-semibold bg-stone-50 border-b border-stone-200">
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3">Contact</th>
                <th className="text-left px-5 py-3">Stage</th>
                <th className="text-left px-5 py-3">Assignee</th>
                <th className="text-left px-5 py-3">Source</th>
                <th className="text-left px-5 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((l) => (
                <tr key={l.id} className="border-b border-stone-100 hover:bg-stone-50">
                  <td className="px-5 py-3.5">
                    <Link to={`/lead/${l.id}`} className="font-semibold text-stone-800 hover:text-[#C05B43]">{l.name}</Link>
                    <div className="text-xs text-stone-500">{l.country_interest} · {l.course_interest}</div>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-stone-600">{l.phone || "—"}<br /><span className="text-stone-400">{l.email || ""}</span></td>
                  <td className="px-5 py-3.5"><StageBadge pipeline={pipeline} stage={l.stage} /></td>
                  <td className="px-5 py-3.5 text-xs">
                    {user?.role === "admin" ? (
                      <Select value={l.assigned_to || "__none__"} onValueChange={(v) => onAssignChange(l, v)}>
                        <SelectTrigger className="h-7 text-[11px] w-36"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Unassigned</SelectItem>
                          {users.map((u) => (<SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    ) : (l.assigned_to_name || "—")}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-stone-500 capitalize">{l.source}</td>
                  <td className="px-5 py-3.5 text-xs text-stone-500">{new Date(l.created_at).toLocaleDateString()}</td>
                </tr>
              ))}

              {filteredLeads.length === 0 && (
  <tr>
    <td
      colSpan={6}
      className="text-center py-12 text-sm text-stone-400"
    >
      {searchTerm ? "No matching leads found" : "No leads found"}
    </td>
  </tr>
)}

              
            </tbody>
          </table>
        </div>
      )}

      <LeadDialog open={openNew} onOpenChange={setOpenNew} pipeline={pipeline} onCreated={() => load()} />
    </Layout>
  );
}
