import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Plus, Check, X, Clock, Calendar as CalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function LeadTasks({ leadId }) {
  const [tasks, setTasks] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", due_at: "", remind_at: "" });

  const load = async () => { const { data } = await api.get("/tasks", { params: { lead_id: leadId } }); setTasks(data); };
  useEffect(() => { load(); }, [leadId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.due_at) { toast.error("Title & due date required"); return; }
    try {
      await api.post("/tasks", { lead_id: leadId, ...form, remind_at: form.remind_at || null });
      toast.success("Task added"); setOpen(false);
      setForm({ title: "", description: "", due_at: "", remind_at: "" });
      load();
    } catch (e) { toast.error("Failed"); }
  };

  const complete = async (t) => { await api.patch(`/tasks/${t.id}`, { status: "done" }); toast.success("Marked done"); load(); };
  const remove = async (t) => { await api.delete(`/tasks/${t.id}`); load(); };

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-lg flex items-center gap-2"><CalIcon className="w-4 h-4 text-[#C05B43]" /> Tasks & Reminders</h3>
        <Button size="sm" onClick={() => setOpen(!open)} data-testid="new-task-button" className="bg-[#C05B43] hover:bg-[#A64D37]"><Plus className="w-4 h-4 mr-1" /> New Task</Button>
      </div>
      {open && (
        <form onSubmit={submit} className="mb-4 grid grid-cols-2 gap-3 border-b border-stone-100 pb-4">
          <div className="col-span-2"><Label className="text-xs">Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="task-title" /></div>
          <div className="col-span-2"><Label className="text-xs">Description / Comment</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><Label className="text-xs">Due (date & time)</Label><Input type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} data-testid="task-due" /></div>
          <div><Label className="text-xs">Remind at (optional)</Label><Input type="datetime-local" value={form.remind_at} onChange={(e) => setForm({ ...form, remind_at: e.target.value })} /></div>
          <div className="col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" size="sm" className="bg-[#1B365D]" data-testid="task-submit">Add Task</Button>
          </div>
        </form>
      )}
      <div className="space-y-2">
        {tasks.length === 0 && <div className="text-sm text-stone-400 text-center py-6">No tasks yet.</div>}
        {tasks.map((t) => (
          <div key={t.id} className={`flex items-center gap-3 border border-stone-100 rounded-xl p-3 ${t.status === "done" ? "opacity-60 bg-stone-50" : ""}`}>
            <button onClick={() => complete(t)} className={`w-5 h-5 rounded-full border-2 grid place-items-center ${t.status === "done" ? "bg-emerald-500 border-emerald-500" : "border-stone-300 hover:border-[#C05B43]"}`}>
              {t.status === "done" && <Check className="w-3 h-3 text-white" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold text-stone-800 ${t.status === "done" ? "line-through" : ""}`}>{t.title}</div>
              {t.description && <div className="text-xs text-stone-500 mt-0.5">{t.description}</div>}
              <div className="text-[11px] text-stone-400 mt-1 flex items-center gap-2">
                <Clock className="w-3 h-3" /> Due: {new Date(t.due_at).toLocaleString()}
                {t.assigned_to_name && <span>· @{t.assigned_to_name}</span>}
              </div>
            </div>
            <button onClick={() => remove(t)} className="text-stone-400 hover:text-rose-600 p-1"><X className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
