import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api, { PIPELINE_STAGES, STAGE_MAP, PIPELINE_LABELS } from "@/lib/api";
import { useParams, Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Mail, Phone, Globe, MessageSquare, Clock } from "lucide-react";
import StageBadge from "@/components/StageBadge";
import { useAuth } from "@/context/AuthContext";

export default function LeadDetail() {
  const { user } = useAuth();
  const { id } = useParams();
  const [lead, setLead] = useState(null);
  const [users, setUsers] = useState([]);
  const [note, setNote] = useState("");
  const [edit, setEdit] = useState({ name: "", email: "", phone: "", country_interest: "", course_interest: "" });

  const load = async () => {
    const { data } = await api.get(`/leads/${id}`);
    setLead(data);
    setEdit({
      name: data.name, email: data.email, phone: data.phone,
      country_interest: data.country_interest, course_interest: data.course_interest,
    });
  };

  useEffect(() => { load(); if (user?.role === "admin") api.get("/users").then((r) => setUsers(r.data)); }, [id, user]);

  if (!lead) return <Layout title="Lead"><div className="text-sm text-stone-500">Loading…</div></Layout>;

  const stages = PIPELINE_STAGES[lead.pipeline];

  const updateField = async (patch) => {
    try {
      const { data } = await api.patch(`/leads/${id}`, patch);
      setLead(data);
      toast.success("Updated");
    } catch (e) { toast.error("Failed"); }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    try {
      await api.post(`/leads/${id}/notes`, { text: note });
      setNote("");
      toast.success("Note added");
      load();
    } catch (e) { toast.error("Failed"); }
  };

  const saveEdit = async () => {
    await updateField(edit);
  };

  return (
    <Layout
      title={lead.name}
      subtitle={`${PIPELINE_LABELS[lead.pipeline]} · Created ${new Date(lead.created_at).toLocaleDateString()}`}
      actions={
        <Link to={`/pipeline/${lead.pipeline === "study_abroad" ? "study" : lead.pipeline}`} className="text-xs text-stone-500 inline-flex items-center gap-1 hover:text-stone-800">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to pipeline
        </Link>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Header */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#C05B43]/10 text-[#C05B43] grid place-items-center font-display font-bold text-xl">
                {lead.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h2 className="font-display font-bold text-2xl">{lead.name}</h2>
                  <StageBadge pipeline={lead.pipeline} stage={lead.stage} />
                </div>
                <div className="text-sm text-stone-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {lead.email && <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {lead.email}</span>}
                  {lead.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {lead.phone}</span>}
                  <span className="inline-flex items-center gap-1 capitalize"><Globe className="w-3.5 h-3.5" /> {lead.source}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <div>
                <label className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Name</label>
                <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className="mt-1" data-testid="edit-name" />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Phone</label>
                <Input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Email</label>
                <Input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Country</label>
                <Input value={edit.country_interest} onChange={(e) => setEdit({ ...edit, country_interest: e.target.value })} className="mt-1" />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Course</label>
                <Input value={edit.course_interest} onChange={(e) => setEdit({ ...edit, course_interest: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={saveEdit} className="bg-[#C05B43] hover:bg-[#A64D37]" data-testid="save-lead">Save Changes</Button>
            </div>
          </div>

          {/* Activity + notes */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-stone-400" />
              <h3 className="font-display font-semibold text-lg">Activity & Notes</h3>
            </div>
            <div className="flex gap-2 mb-5">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note or update…" rows={2} data-testid="note-input" />
              <Button onClick={addNote} className="bg-[#1B365D] hover:bg-[#152a4a] self-end" data-testid="add-note-button"><MessageSquare className="w-4 h-4 mr-1" /> Post</Button>
            </div>
            <div className="space-y-3">
              {(lead.activity || []).slice().reverse().map((a, idx) => (
                <div key={idx} className="border-l-2 border-[#C05B43]/30 pl-3 py-1">
                  <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">{a.type.replace("_", " ")} · {a.by}</div>
                  <div className="text-sm text-stone-700 mt-0.5">{a.text}</div>
                  <div className="text-[11px] text-stone-400 mt-0.5">{new Date(a.at).toLocaleString()}</div>
                </div>
              ))}
              {(!lead.activity || lead.activity.length === 0) && <div className="text-sm text-stone-400">No activity yet.</div>}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div className="bg-white border border-stone-200 rounded-2xl p-6">
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Current Stage</div>
            <div className="mt-2"><StageBadge pipeline={lead.pipeline} stage={lead.stage} /></div>
            <div className="mt-4">
              <label className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Move to</label>
              <Select value={lead.stage} onValueChange={(v) => updateField({ stage: v })}>
                <SelectTrigger data-testid="detail-stage-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => <SelectItem key={s} value={s}>{s} · {STAGE_MAP[lead.pipeline][s].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {user?.role === "admin" && (
            <div className="bg-white border border-stone-200 rounded-2xl p-6">
              <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Assigned Counsellor</div>
              <div className="mt-3">
                <Select value={lead.assigned_to || "__none__"} onValueChange={(v) => updateField({ assigned_to: v === "__none__" ? null : v })}>
                  <SelectTrigger data-testid="detail-assign-select"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="bg-[#F5F2ED] border border-stone-200 rounded-2xl p-6">
            <div className="text-[11px] uppercase tracking-widest text-stone-500 font-semibold">Metadata</div>
            <div className="mt-3 space-y-2 text-xs text-stone-600">
              <div className="flex justify-between"><span className="text-stone-400">Pipeline</span><span className="capitalize font-semibold">{PIPELINE_LABELS[lead.pipeline]}</span></div>
              <div className="flex justify-between"><span className="text-stone-400">Source</span><span className="capitalize font-semibold">{lead.source}</span></div>
              <div className="flex justify-between"><span className="text-stone-400">Created</span><span>{new Date(lead.created_at).toLocaleDateString()}</span></div>
              <div className="flex justify-between"><span className="text-stone-400">Updated</span><span>{new Date(lead.updated_at).toLocaleDateString()}</span></div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
