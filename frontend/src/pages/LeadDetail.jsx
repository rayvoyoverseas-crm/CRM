import React, { useCallback, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api, { PIPELINE_STAGES, STAGE_MAP, PIPELINE_LABELS, COUNTRIES } from "@/lib/api";
import { useParams, Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Mail, Phone, Globe, MessageSquare, Clock } from "lucide-react";
import StageBadge from "@/components/StageBadge";
import { useAuth } from "@/context/AuthContext";
import LeadDocuments from "@/components/LeadDocuments";
import LeadTasks from "@/components/LeadTasks";
import { LeadReferees, LeadLoanInfo } from "@/components/LeadExtras";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STAGE_TRANSITIONS = {
  NL: ["CC"],
  CC: ["SL"],
  SL: ["DR"],
  DR: ["PR"],
  PR: ["RA"],
  RA: ["AP"],
  AP: ["OL"],
  OL: ["RD"],
  RD: ["DP"],
  DP: ["VS"],
  VS: ["EN"],
  EN: [],
};

export default function LeadDetail() {
  const { user } = useAuth();
  const { id } = useParams();
  const [lead, setLead] = useState(null);
  const [users, setUsers] = useState([]);
  const [note, setNote] = useState("");
  const [callForm, setCallForm] = useState({
  call_date: "",
  call_time: "",
  outcome: "",
  notes: "",
});

const [savingCall, setSavingCall] = useState(false);
  const emptyShortlist = {
  country: "",
  intake: "",
  level_of_study: "",
  university_name: "",
  course: "",
  course_link: "",
  shortlist_status: "",
  tuition_fee: "",
  application_fee: "",
  counsellor_remarks: "",
};

const [shortlistForms, setShortlistForms] = useState([
  { ...emptyShortlist },
]);

const [savingShortlistIndex, setSavingShortlistIndex] = useState(null);
  const [edit, setEdit] = useState({ name: "", email: "", phone: "", country_interest: "", course_interest: "" });

const load = useCallback(async () => {
  const { data } = await api.get(`/leads/${id}`);

  setLead(data);

  setEdit({
    name: data.name,
    email: data.email,
    phone: data.phone,
    country_interest: data.country_interest,
    course_interest: data.course_interest,
  });

  const savedShortlists = Array.isArray(data.shortlists)
    ? data.shortlists
    : [];

  const loadedShortlists = savedShortlists.map((shortlist) => ({
  country: shortlist.country || "",
  intake: shortlist.intake || "",
  level_of_study: shortlist.level_of_study || "",
  university_name: shortlist.university_name || "",
  course: shortlist.course || "",
  course_link: shortlist.course_link || "",
  shortlist_status: shortlist.shortlist_status || "",
  tuition_fee: shortlist.tuition_fee || "",
  application_fee: shortlist.application_fee || "",
  counsellor_remarks: shortlist.counsellor_remarks || "",
  id: shortlist.id,
  saved_at: shortlist.saved_at,
  saved_by: shortlist.saved_by,
}));

if (loadedShortlists.length === 0) {
  setShortlistForms([
    { ...emptyShortlist },
  ]);
} else {
  setShortlistForms(loadedShortlists);
}
}, [id]);

useEffect(() => {
  load();

  if (user?.role === "admin") {
    api.get("/users").then((r) => setUsers(r.data));
  }
}, [load, user]);

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

  const saveCallHistory = async () => {
  if (
    !callForm.call_date ||
    !callForm.call_time ||
    !callForm.outcome ||
    !callForm.notes.trim()
  ) {
    toast.error("Please complete all call history fields");
    return;
  }

  try {
    setSavingCall(true);

    await api.post(`/leads/${id}/call-history`, callForm);

    setCallForm({
      call_date: "",
      call_time: "",
      outcome: "",
      notes: "",
    });

    toast.success("Call history saved");
    load();
  } catch (e) {
    toast.error(
      e?.response?.data?.detail || "Failed to save call history"
    );
  } finally {
    setSavingCall(false);
  }
};

  const updateShortlistField = (index, field, value) => {
  const updated = [...shortlistForms];
  updated[index][field] = value;
  setShortlistForms(updated);
};

const addMoreShortlist = () => {
  if (shortlistForms.length >= 10) return;

  setShortlistForms([
    ...shortlistForms,
    { ...emptyShortlist },
  ]);
};

const saveShortlist = async (index) => {
  try {
    setSavingShortlistIndex(index);

    const { data } = await api.post(
      `/leads/${id}/shortlists`,
      shortlistForms[index]
    );

    toast.success("Shortlist saved");

    await load();
  } catch (err) {
    toast.error(
      err?.response?.data?.detail ||
      "Unable to save shortlist."
    );
  } finally {
    setSavingShortlistIndex(null);
  }
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
          <Tabs defaultValue="overview">
            <TabsList className="mb-3">
  <TabsTrigger value="overview" data-testid="tab-overview">
    Overview
  </TabsTrigger>

  <TabsTrigger value="tasks" data-testid="tab-tasks">
    Tasks
  </TabsTrigger>

  <TabsTrigger value="referees" data-testid="tab-referees">
    Referees
  </TabsTrigger>

  {lead.pipeline === "loan" && (
    <TabsTrigger value="loan" data-testid="tab-loan">
      Loan Info
    </TabsTrigger>
  )}
</TabsList>

            <TabsContent value="overview" className="space-y-5">
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
                <Select value={edit.country_interest || ""} onValueChange={(v) => setEdit({ ...edit, country_interest: v })}>
                  <SelectTrigger className="mt-1" data-testid="country-select"><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <label className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Course</label>
                <Input value={edit.course_interest} onChange={(e) => setEdit({ ...edit, course_interest: e.target.value })} className="mt-1" />
              </div>
            </div>

            
            <div className="mt-4 flex justify-end">
              <Button
                onClick={saveEdit}
                className="bg-[#C05B43] hover:bg-[#A64D37]"
                data-testid="save-lead"
              >
                Save Changes
              </Button>
            </div>
          </div>

          {/* Documents dropdown */}
          <details className="group bg-white border border-stone-200 rounded-2xl overflow-hidden">
            <summary className="cursor-pointer list-none flex items-center justify-between px-6 py-5 hover:bg-stone-50">
              <div>
                <h3 className="font-display font-semibold text-lg">
                  Documents
                </h3>
                <p className="text-xs text-stone-400 mt-1">
                  Upload and manage documents for this lead
                </p>
              </div>

              <span className="text-stone-500 text-sm transition-transform group-open:rotate-180">
                ▼
              </span>
            </summary>

            <div className="border-t border-stone-200 p-6">
              <LeadDocuments
                lead={lead}
                onUpdate={load}
                mode={lead.pipeline === "loan" ? "loan" : "study"}
              />
            </div>
          </details>

          {/* Activity dropdown */}
          <details className="group bg-white border border-stone-200 rounded-2xl overflow-hidden">
            <summary className="cursor-pointer list-none flex items-center justify-between px-6 py-5 hover:bg-stone-50">
              <div>
                <h3 className="font-display font-semibold text-lg">
                  Activity
                </h3>
                <p className="text-xs text-stone-400 mt-1">
                  View updates and history for this lead
                </p>
              </div>

              <span className="text-stone-500 text-sm transition-transform group-open:rotate-180">
                ▼
              </span>
            </summary>

            <div className="border-t border-stone-200 p-6">
              <div className="space-y-3">
                {(lead.activity || [])
                  .slice()
                  .reverse()
                  .map((activity, index) => (
                    <div
                      key={index}
                      className="border-l-2 border-[#C05B43]/30 pl-3 py-1"
                    >
                      <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">
                        {activity.type.replace("_", " ")} · {activity.by}
                      </div>

                      <div className="text-sm text-stone-700 mt-0.5">
                        {activity.text}
                      </div>

                      <div className="text-[11px] text-stone-400 mt-0.5">
                        {new Date(activity.at).toLocaleString()}
                      </div>
                    </div>
                  ))}

                {(!lead.activity || lead.activity.length === 0) && (
                  <div className="text-sm text-stone-400">
                    No activity yet.
                  </div>
                )}
              </div>
            </div>
          </details>
        </TabsContent>

            <TabsContent value="tasks"><LeadTasks leadId={lead.id} /></TabsContent>
            <TabsContent value="referees"><LeadReferees lead={lead} onUpdate={load} /></TabsContent>
            {lead.pipeline === "loan" && <TabsContent value="loan"><LeadLoanInfo lead={lead} onUpdate={load} /></TabsContent>}
          </Tabs>
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Notes */}
  <div className="bg-white border border-stone-200 rounded-2xl p-6">
    <div className="flex items-center gap-2 mb-4">
      <MessageSquare className="w-4 h-4 text-[#C05B43]" />

      <div>
        <h3 className="font-display font-semibold text-lg">
          Notes
        </h3>

        <p className="text-xs text-stone-400 mt-0.5">
          Add a note for this lead
        </p>
      </div>
    </div>

    <Textarea
      value={note}
      onChange={(event) => setNote(event.target.value)}
      placeholder="Write a note or update..."
      rows={5}
      data-testid="note-input"
    />

    <Button
      onClick={addNote}
      disabled={!note.trim()}
      className="w-full mt-3 bg-[#1B365D] hover:bg-[#152a4a]"
      data-testid="add-note-button"
    >
      <MessageSquare className="w-4 h-4 mr-1" />
      Add Note
    </Button>
  </div>

          {/* Call History */}
<div className="bg-white border border-stone-200 rounded-2xl p-6">
  <div className="flex items-center gap-2 mb-4">
    <Phone className="w-4 h-4 text-[#C05B43]" />
    <div>
      <h3 className="font-display font-semibold text-lg">
        Call History
      </h3>
      <p className="text-xs text-stone-400 mt-0.5">
        Record every call made to this lead
      </p>
    </div>
  </div>

  <div className="space-y-3">
    <Input
      type="date"
      value={callForm.call_date}
      onChange={(e) =>
        setCallForm({ ...callForm, call_date: e.target.value })
      }
    />

    <Input
      type="time"
      value={callForm.call_time}
      onChange={(e) =>
        setCallForm({ ...callForm, call_time: e.target.value })
      }
    />

    <Select
      value={callForm.outcome}
      onValueChange={(v) =>
        setCallForm({ ...callForm, outcome: v })
      }
    >
      <SelectTrigger>
        <SelectValue placeholder="Select outcome" />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="Call Made">Call Made</SelectItem>
        <SelectItem value="No Answer">No Answer</SelectItem>
        <SelectItem value="Busy">Busy</SelectItem>
        <SelectItem value="Switched Off">Switched Off</SelectItem>
        <SelectItem value="Wrong Number">Wrong Number</SelectItem>
        <SelectItem value="Call Back Requested">
          Call Back Requested
        </SelectItem>
      </SelectContent>
    </Select>

    <Textarea
      rows={4}
      placeholder="Call notes..."
      value={callForm.notes}
      onChange={(e) =>
        setCallForm({ ...callForm, notes: e.target.value })
      }
    />

    <Button
      onClick={saveCallHistory}
      disabled={savingCall}
      className="w-full bg-[#C05B43] hover:bg-[#A64D37]"
    >
      {savingCall ? "Saving..." : "Save Call"}
    </Button>

{lead.call_history && lead.call_history.length > 0 && (
  <div className="mt-6 space-y-3">
    <h4 className="text-sm font-semibold text-stone-700">
      Previous Calls
    </h4>

    {[...lead.call_history].reverse().map((call, index) => (
      <div
        key={index}
        className="border rounded-lg p-3 bg-stone-50"
      >
        <div className="text-xs text-stone-500">
          📅 {call.call_date} &nbsp; 🕒 {call.call_time}
        </div>

        <div className="mt-1">
          <span className="font-semibold">Outcome:</span> {call.outcome}
        </div>

        <div className="mt-1 text-sm text-stone-700">
          {call.notes}
        </div>

        <div className="mt-2 text-xs text-stone-400">
          By {call.by}
        </div>
      </div>
    ))}
  </div>
)}
    
  </div>
</div>

          {/* Shortlisting */}
<div className="bg-white border border-stone-200 rounded-2xl p-6">
  <div className="mb-5">
    <h3 className="font-display font-semibold text-lg">
      Shortlisting
    </h3>

    <p className="text-xs text-stone-400 mt-1">
      Save at least 3 complete shortlist entries before moving this lead to SL.
    </p>
  </div>

  <div className="space-y-6">
    {shortlistForms.map((form, index) => (
      <details
  key={form.id || index}
  open={!form.id}
  className="group border border-stone-200 rounded-xl overflow-hidden"
>
  <summary className="cursor-pointer list-none flex items-center justify-between px-4 py-4 bg-stone-50 hover:bg-stone-100">
    <div>
      <h4 className="font-semibold text-sm">
        Shortlist {index + 1}
        {index < 2 && (
          <span className="text-red-500 ml-1">*</span>
        )}
      </h4>

      {form.id && (
        <p className="text-xs text-stone-500 mt-1">
          {form.university_name} · {form.course}
        </p>
      )}
    </div>

    <span className="text-stone-500 text-sm transition-transform group-open:rotate-180">
      ▼
    </span>
  </summary>

  <div className="p-4">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">
              Country *
            </Label>
            <Input
              value={form.country}
              onChange={(e) =>
                updateShortlistField(
                  index,
                  "country",
                  e.target.value
                )
              }
              placeholder="Enter country"
            />
          </div>

          <div>
            <Label className="text-xs">
              Intake *
            </Label>
            <Input
              value={form.intake}
              onChange={(e) =>
                updateShortlistField(
                  index,
                  "intake",
                  e.target.value
                )
              }
              placeholder="Example: September 2026"
            />
          </div>

          <div>
            <Label className="text-xs">
              Level of Study *
            </Label>
            <Input
              value={form.level_of_study}
              onChange={(e) =>
                updateShortlistField(
                  index,
                  "level_of_study",
                  e.target.value
                )
              }
              placeholder="UG / PG / Diploma"
            />
          </div>

          <div>
            <Label className="text-xs">
              University Name *
            </Label>
            <Input
              value={form.university_name}
              onChange={(e) =>
                updateShortlistField(
                  index,
                  "university_name",
                  e.target.value
                )
              }
              placeholder="Enter university name"
            />
          </div>

          <div>
            <Label className="text-xs">
              Course *
            </Label>
            <Input
              value={form.course}
              onChange={(e) =>
                updateShortlistField(
                  index,
                  "course",
                  e.target.value
                )
              }
              placeholder="Enter course"
            />
          </div>

          <div>
            <Label className="text-xs">
              Course Link *
            </Label>
            <Input
              value={form.course_link}
              onChange={(e) =>
                updateShortlistField(
                  index,
                  "course_link",
                  e.target.value
                )
              }
              placeholder="Paste course URL"
            />
          </div>

          <div>
            <Label className="text-xs">
              Shortlist Status *
            </Label>

            <Select
              value={form.shortlist_status}
              onValueChange={(value) =>
                updateShortlistField(
                  index,
                  "shortlist_status",
                  value
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="Recommended">
                  Recommended
                </SelectItem>

                <SelectItem value="Student Approved">
                  Student Approved
                </SelectItem>

                <SelectItem value="Student Rejected">
                  Student Rejected
                </SelectItem>

                <SelectItem value="Application Planned">
                  Application Planned
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">
              Tuition Fee
            </Label>
            <Input
              value={form.tuition_fee}
              onChange={(e) =>
                updateShortlistField(
                  index,
                  "tuition_fee",
                  e.target.value
                )
              }
              placeholder="Enter tuition fee"
            />
          </div>

          <div>
            <Label className="text-xs">
              Application Fee
            </Label>
            <Input
              value={form.application_fee}
              onChange={(e) =>
                updateShortlistField(
                  index,
                  "application_fee",
                  e.target.value
                )
              }
              placeholder="Enter application fee"
            />
          </div>
        </div>

        <div className="mt-3">
          <Label className="text-xs">
            Counsellor Remarks
          </Label>

          <Textarea
            rows={3}
            value={form.counsellor_remarks}
            onChange={(e) =>
              updateShortlistField(
                index,
                "counsellor_remarks",
                e.target.value
              )
            }
            placeholder="Add remarks"
          />
        </div>

        <Button
          onClick={() => saveShortlist(index)}
          disabled={savingShortlistIndex === index}
          className="w-full mt-4 bg-[#1B365D] hover:bg-[#152a4a]"
        >
          {savingShortlistIndex === index
            ? "Saving..."
            : `Save Shortlist ${index + 1}`}
        </Button>
      </div>
        </details>
    ))}
  </div>

  (lead?.shortlists?.length || 0) >= 1 &&
  shortlistForms.length < 10 && (
    <Button
      type="button"
      variant="outline"
      onClick={addMoreShortlist}
      className="w-full mt-4"
    >
      + Add More
    </Button>
)}
</div>

          {/* Current Stage*/}
          <div className="bg-white border border-stone-200 rounded-2xl p-6">
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">
              Current Stage
            </div>
            
            <div className="mt-2">
              <StageBadge pipeline={lead.pipeline} stage={lead.stage} />
            </div>
            
            <div className="mt-4">
              <label className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">
                Move to
              </label>
              
              <Select onValueChange={(v) => updateField({ stage: v })}>
  <SelectTrigger data-testid="detail-stage-select">
    <SelectValue placeholder="Move to next stage" />
  </SelectTrigger>

  <SelectContent>
    {(STAGE_TRANSITIONS[lead.stage] || []).map((s) => (
      <SelectItem key={s} value={s}>
        {s} · {STAGE_MAP[lead.pipeline][s].label}
      </SelectItem>
    ))}
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
