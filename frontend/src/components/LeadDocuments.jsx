import React, { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import { Upload, FileText, Trash2, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const BASE_DOCS = [
  { key: "10th", label: "10th Certificate", qual: ["12th", "UG", "PG"] },
  { key: "12th", label: "12th / Diploma Certificate", qual: ["12th", "UG", "PG"] },
  { key: "ug_sem", label: "UG · Semester-wise Marksheets", qual: ["UG", "PG"] },
  { key: "ug_transcript", label: "UG · Transcript", qual: ["UG", "PG"] },
  { key: "ug_degree", label: "UG · Degree Certificate", qual: ["UG", "PG"] },
  { key: "ug_grading", label: "UG · Grading Scale", qual: ["UG", "PG"] },
  { key: "pg_sem", label: "PG · Semester-wise Marksheets", qual: ["PG"] },
  { key: "pg_transcript", label: "PG · Transcript", qual: ["PG"] },
  { key: "pg_degree", label: "PG · Degree Certificate", qual: ["PG"] },
  { key: "pg_grading", label: "PG · Grading Scale", qual: ["PG"] },
  { key: "passport", label: "Passport", qual: ["12th", "UG", "PG"], metaFields: ["name_on_passport", "passport_no", "address"] },
  { key: "ept_ielts", label: "EPT · IELTS", qual: ["12th", "UG", "PG"] },
  { key: "ept_toefl", label: "EPT · TOEFL", qual: ["12th", "UG", "PG"] },
  { key: "ept_duolingo", label: "EPT · Duolingo", qual: ["12th", "UG", "PG"] },
  { key: "sop", label: "SOP", qual: ["12th", "UG", "PG"] },
  { key: "aps", label: "APS", qual: ["12th", "UG", "PG"] },
  { key: "other_1", label: "Other Document 1", qual: ["12th", "UG", "PG"] },
  { key: "other_2", label: "Other Document 2", qual: ["12th", "UG", "PG"] },
  { key: "other_3", label: "Other Document 3", qual: ["12th", "UG", "PG"] },
];

function DocSlot({ leadId, cfg, existing, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [meta, setMeta] = useState(existing?.meta || {});
  const inp = useRef(null);

  const upload = async (file) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/leads/${leadId}/documents`, fd, {
        params: { doc_type: cfg.key, meta: JSON.stringify(meta) },
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(`${cfg.label} uploaded`);
      onChange();
    } catch (e) { toast.error("Upload failed"); }
    finally { setUploading(false); }
  };

  const download = async () => {
    try {
      const res = await api.get(`/documents/${existing.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = existing.original_filename; a.click();
    } catch (e) { toast.error("Failed"); }
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${cfg.label}?`)) return;
    await api.delete(`/documents/${existing.id}`); toast.success("Deleted"); onChange();
  };

  return (
    <div className="border border-stone-200 rounded-xl p-3 bg-white">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-stone-400 shrink-0" />
          <div className="text-xs font-semibold text-stone-800 truncate">{cfg.label}</div>
        </div>
        {existing ? (
          <div className="flex items-center gap-1">
            <button onClick={download} data-testid={`download-${cfg.key}`} className="p-1 text-stone-500 hover:text-stone-800"><Download className="w-3.5 h-3.5" /></button>
            <button onClick={remove} className="p-1 text-stone-500 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ) : null}
      </div>
      {cfg.metaFields && (
        <div className="mt-2 grid grid-cols-1 gap-1">
          {cfg.metaFields.map((f) => (
            <Input key={f} placeholder={f.replace(/_/g, " ")} className="h-7 text-xs"
              value={meta[f] || ""} onChange={(e) => setMeta({ ...meta, [f]: e.target.value })} />
          ))}
        </div>
      )}
      {existing ? (
        <div className="mt-2 text-[10px] text-stone-500 truncate">{existing.original_filename}</div>
      ) : (
        <>
          <input ref={inp} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} data-testid={`upload-input-${cfg.key}`} />
          <Button size="sm" variant="outline" className="w-full mt-2 h-7 text-xs" onClick={() => inp.current?.click()} disabled={uploading} data-testid={`upload-${cfg.key}`}>
            {uploading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Upload className="w-3 h-3 mr-1" />} Upload
          </Button>
        </>
      )}
    </div>
  );
}

export default function LeadDocuments({ lead, onUpdate }) {
  const [docs, setDocs] = useState([]);
  const [qual, setQual] = useState(lead.highest_qualification || "");

  const load = async () => { const { data } = await api.get(`/leads/${lead.id}/documents`); setDocs(data); };
  useEffect(() => { load(); }, [lead.id]);

  const saveQual = async (v) => {
    setQual(v);
    await api.patch(`/leads/${lead.id}/extras`, { highest_qualification: v });
    toast.success("Qualification updated");
    onUpdate?.();
  };

  const docsFor = qual ? BASE_DOCS.filter((d) => d.qual.includes(qual)) : [];

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-lg">Documents</h3>
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Highest Qualification</span>
          <Select value={qual} onValueChange={saveQual}>
            <SelectTrigger className="w-40 h-8 text-xs" data-testid="highest-qual-select"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="12th">12th Completed</SelectItem>
              <SelectItem value="UG">UG Completed</SelectItem>
              <SelectItem value="PG">PG Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {!qual && <div className="text-sm text-stone-400 py-6 text-center border-2 border-dashed border-stone-200 rounded-xl">Select highest qualification to unlock the document checklist.</div>}
      {qual && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {docsFor.map((cfg) => {
            const existing = docs.find((d) => d.doc_type === cfg.key);
            return <DocSlot key={cfg.key} leadId={lead.id} cfg={cfg} existing={existing} onChange={load} />;
          })}
        </div>
      )}
    </div>
  );
}
