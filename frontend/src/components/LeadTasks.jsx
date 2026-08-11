import React, { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { Plus, Check, X, Clock, Calendar as CalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function LeadTasks({
  leadId,
  compact = false,
  showForm = false,
  onCloseForm,
}) {
  const [tasks, setTasks] = useState([]);
  const [open, setOpen] = useState(showForm);
  const [form, setForm] = useState({
  title: "",
  description: "",
  due_date: "",
  due_time: "",
  reminder_date: "",
  reminder_time: "",
});

  const load = useCallback(async () => {
  const { data } = await api.get("/tasks", {
    params: { lead_id: leadId },
  });

  setTasks(data);
}, [leadId]);

useEffect(() => {
  load();
}, [load]);

useEffect(() => {
  if (compact) {
    setOpen(showForm);
  }
}, [showForm, compact]);

  const submit = async (e) => {
    e.preventDefault();
    if (
  !form.title ||
  !form.due_date ||
  !form.due_time
) {
  toast.error("Title, due date and due time are required");
  return;
}
    try {
      const dueAt =
  `${form.due_date}T${form.due_time}`;

const remindAt =
  form.reminder_date && form.reminder_time
    ? `${form.reminder_date}T${form.reminder_time}`
    : null;
      await api.post("/tasks", {
        lead_id: leadId,
        title: form.title,
        description: form.description,
        due_at: dueAt,
        remind_at: remindAt,
      });
      toast.success("Task added");
      
      setOpen(false);
      
      setForm({
      title: "",
      description: "",
      due_date: "",
      due_time: "",
      reminder_date: "",
      reminder_time: "",
    });
      
      await load();
      
      if (compact && onCloseForm) {
        onCloseForm();
      }
    } catch (e) { toast.error("Failed"); }
  };

  const complete = async (t) => { await api.patch(`/tasks/${t.id}`, { status: "done" }); toast.success("Marked done"); load(); };
  const remove = async (t) => { await api.delete(`/tasks/${t.id}`); load(); };

return (
  <div
    className={
      compact
        ? ""
        : "bg-white border border-stone-200 rounded-2xl p-6"
    }
  >

    {!compact && (
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-lg flex items-center gap-2">
          <CalIcon className="w-4 h-4 text-[#C05B43]" />
          Tasks & Reminders
        </h3>

        <Button
          size="sm"
          onClick={() => setOpen(!open)}
          data-testid="new-task-button"
          className="bg-[#C05B43] hover:bg-[#A64D37]"
        >
          <Plus className="w-4 h-4 mr-1" />
          New Task
        </Button>
      </div>
    )}

    {open && (
      <form
        onSubmit={submit}
        className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3"
      >

        <div className="col-span-2">
          <Label className="text-xs">
            Title
          </Label>

          <Input
            value={form.title}
            onChange={(e) =>
              setForm({
                ...form,
                title: e.target.value,
              })
            }
            placeholder="e.g. Call student"
            data-testid="task-title"
          />
        </div>

        <div className="col-span-2">
          <Label className="text-xs">
            Description / Comment
          </Label>

          <Textarea
            rows={2}
            value={form.description}
            onChange={(e) =>
              setForm({
                ...form,
                description: e.target.value,
              })
            }
            placeholder="Add details..."
          />
        </div>

        <div>
          <Label className="text-xs">
            Due (date & time)
          </Label>
        
          <Input
            type="datetime-local"
            value={
              form.due_date && form.due_time
                ? `${form.due_date}T${form.due_time}`
                : ""
            }
            onChange={(e) => {
              const [date, time] = e.target.value.split("T");
        
              setForm({
                ...form,
                due_date: date || "",
                due_time: time || "",
              });
            }}
            data-testid="task-due"
          />
        </div>
        
        <div>
          <Label className="text-xs">
            Remind at (optional)
          </Label>
        
          <Input
            type="datetime-local"
            value={
              form.reminder_date && form.reminder_time
                ? `${form.reminder_date}T${form.reminder_time}`
                : ""
            }
            onChange={(e) => {
              const [date, time] = e.target.value.split("T");
        
              setForm({
                ...form,
                reminder_date: date || "",
                reminder_time: time || "",
              });
            }}
          />
        </div>
        <div className="col-span-2 flex justify-end gap-2">

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setOpen(false);

              if (compact && onCloseForm) {
                onCloseForm();
              }
            }}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            size="sm"
            className="bg-[#1B365D]"
            data-testid="task-submit"
          >
            Add Task
          </Button>

        </div>
      </form>
    )}
    {!compact && (
    <div className="space-y-2">

      {tasks.length === 0 && !open && (
        <div className="text-xs text-stone-400 text-center py-3">
          No tasks or reminders yet.
        </div>
      )}

      {tasks.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 rounded-xl border p-3 ${
            t.status === "done"
              ? "border-stone-100 bg-stone-50 opacity-60"
              : "border-stone-200 bg-white"
          }`}
        >

          <button
            type="button"
            onClick={() => {
              if (t.status !== "done") {
                complete(t);
              }
            }}
            className={`mt-0.5 w-5 h-5 rounded-full border-2 grid place-items-center shrink-0 ${
              t.status === "done"
                ? "bg-emerald-500 border-emerald-500"
                : "border-stone-300 hover:border-[#C05B43]"
            }`}
            title={
              t.status === "done"
                ? "Completed"
                : "Mark as completed"
            }
          >
            {t.status === "done" && (
              <Check className="w-3 h-3 text-white" />
            )}
          </button>

          <div className="flex-1 min-w-0">

            <div
              className={`text-sm font-semibold ${
                t.status === "done"
                  ? "line-through text-stone-500"
                  : "text-stone-800"
              }`}
            >
              {t.title}
            </div>

            {t.description && (
              <div className="text-xs text-stone-500 mt-0.5">
                {t.description}
              </div>
            )}

            <div className="text-[11px] text-stone-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />

                Due:{" "}
                {new Date(t.due_at).toLocaleString()}
              </span>

              {t.assigned_to_name && (
                <span>
                  · @{t.assigned_to_name}
                </span>
              )}
            </div>

            {t.remind_at && t.status !== "done" && (
              <div className="text-[11px] text-[#C05B43] mt-1">
                Reminder:{" "}
                {new Date(t.remind_at).toLocaleString()}
              </div>
            )}

          </div>

          <button
            type="button"
            onClick={() => remove(t)}
            className="text-stone-300 hover:text-rose-600 p-1 shrink-0"
            title="Delete task"
          >
            <X className="w-4 h-4" />
          </button>

        </div>
      ))}
    </div>

  </div>
);
}
