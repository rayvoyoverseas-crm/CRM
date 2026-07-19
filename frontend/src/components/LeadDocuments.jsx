import React, { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import { Upload, FileText, Trash2, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const BOARDS_10_12 = ["CBSE", "ICSE", "IB", "IGCSE", "State Board - Maharashtra", "State Board - Karnataka", "State Board - Tamil Nadu", "State Board - Delhi", "State Board - UP", "State Board - Other", "Other"];

const ACADEMIC_META = {
  "10th": [
    { key: "school_name", label: "School Name", type: "text" },
    { key: "board", label: "Board", type: "select", options: BOARDS_10_12 },
    { key: "start_date", label: "Start Date", type: "date" },
    { key: "end_date", label: "End Date", type: "date" },
    { key: "grade_type", label: "CGPA / Percentage", type: "select", options: ["CGPA", "Percentage"] },
    { key: "score", label: "Score", type: "text" },
  ],
  "12th": [
    { key: "school_name", label: "School / Institute Name", type: "text" },
    { key: "board", label: "Board", type: "select", options: BOARDS_10_12 },
    { key: "stream", label: "Stream", type: "select", options: ["Science", "Commerce", "Arts", "Diploma", "Other"] },
    { key: "start_date", label: "Start Date", type: "date" },
    { key: "end_date", label: "End Date", type: "date" },
    { key: "grade_type", label: "CGPA / Percentage", type: "select", options: ["CGPA", "Percentage"] },
    { key: "score", label: "Score", type: "text" },
  ],
  "UG": [
    { key: "university", label: "University / College", type: "text" },
    { key: "degree", label: "Degree (e.g. B.Tech, BBA)", type: "text" },
    { key: "specialization", label: "Specialization", type: "text" },
    { key: "start_date", label: "Start Date", type: "date" },
    { key: "end_date", label: "End Date", type: "date" },
    { key: "grade_type", label: "CGPA / Percentage", type: "select", options: ["CGPA", "Percentage"] },
    { key: "score", label: "Score", type: "text" },
  ],
  "PG": [
    { key: "university", label: "University", type: "text" },
    { key: "degree", label: "Degree (e.g. M.Tech, MBA)", type: "text" },
    { key: "specialization", label: "Specialization", type: "text" },
    { key: "start_date", label: "Start Date", type: "date" },
    { key: "end_date", label: "End Date", type: "date" },
    { key: "grade_type", label: "CGPA / Percentage", type: "select", options: ["CGPA", "Percentage"] },
    { key: "score", label: "Score", type: "text" },
  ],
};

const BASE_DOCS = [
  { key: "10th", label: "10th Certificate", qual: ["12th", "UG", "PG"], meta: ACADEMIC_META["10th"] },
  { key: "12th", label: "12th / Diploma Certificate", qual: ["12th", "UG", "PG"], meta: ACADEMIC_META["12th"] },
  { key: "ug_sem", label: "UG · Semester Marksheets", qual: ["UG", "PG"], meta: ACADEMIC_META["UG"] },
  { key: "ug_transcript", label: "UG · Transcript", qual: ["UG", "PG"] },
  { key: "ug_degree", label: "UG · Degree Certificate", qual: ["UG", "PG"] },
  { key: "ug_grading", label: "UG · Grading Scale", qual: ["UG", "PG"] },
  { key: "pg_sem", label: "PG · Semester Marksheets", qual: ["PG"], meta: ACADEMIC_META["PG"] },
  { key: "pg_transcript", label: "PG · Transcript", qual: ["PG"] },
  { key: "pg_degree", label: "PG · Degree Certificate", qual: ["PG"] },
  { key: "pg_grading", label: "PG · Grading Scale", qual: ["PG"] },
  { key: "passport", label: "Passport", qual: ["12th", "UG", "PG"], meta: [
    { key: "name_on_passport", label: "Name on Passport", type: "text" },
    { key: "passport_no", label: "Passport Number", type: "text" },
    { key: "issue_date", label: "Issue Date", type: "date" },
    { key: "expiry_date", label: "Expiry Date", type: "date" },
    { key: "address", label: "Address on Passport", type: "text" },
  ] },
  {
  key: "ept",
  label: "English Proficiency",
  qual: ["12th", "UG", "PG"],
},
  { key: "sop", label: "SOP", qual: ["12th", "UG", "PG"] },
  { key: "aps", label: "APS", qual: ["12th", "UG", "PG"] },
  { key: "other_1", label: "Other Document 1", qual: ["12th", "UG", "PG"] },
  { key: "other_2", label: "Other Document 2", qual: ["12th", "UG", "PG"] },
  { key: "other_3", label: "Other Document 3", qual: ["12th", "UG", "PG"] },
];

const LOAN_DOCS = [
  { key: "aadhaar", label: "Aadhaar Card", meta: [{ key: "aadhaar_no", label: "Aadhaar Number", type: "text" }] },
  { key: "pan", label: "PAN Card (Applicant)", meta: [{ key: "pan_no", label: "PAN Number", type: "text" }] },
  { key: "coapp_pan", label: "Co-Applicant PAN Card", meta: [{ key: "pan_no", label: "PAN Number", type: "text" }] },
  { key: "address_proof", label: "Address Proof" },
  { key: "salary_slips", label: "Salary Slips (Last 3 months)" },
  { key: "form_16", label: "Form 16 / ITR (Last 2 years)" },
  { key: "bank_statement", label: "Bank Statement (Last 6 months)" },
  { key: "coapp_income", label: "Co-Applicant Income Proof" },
  { key: "cibil_report", label: "CIBIL Report", meta: [{ key: "cibil_score", label: "CIBIL Score", type: "text" }] },
  { key: "collateral_docs", label: "Collateral Documents (if any)" },
  { key: "offer_letter", label: "Admission / Offer Letter" },
  { key: "fee_structure", label: "University Fee Structure" },
  { key: "existing_loan", label: "Existing Loan Statement (if any)" },
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
    const res = await api.get(`/documents/${existing.id}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a"); a.href = url; a.download = existing.original_filename; a.click();
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${cfg.label}?`)) return;
    await api.delete(`/documents/${existing.id}`); toast.success("Deleted"); onChange();
  };

  const renderField = (f) => {
    if (f.type === "select") {
      return (
        <Select value={meta[f.key] || ""} onValueChange={(v) => setMeta({ ...meta, [f.key]: v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={f.label} /></SelectTrigger>
          <SelectContent>{f.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      );
    }
    return <Input type={f.type} placeholder={f.label} className="h-8 text-xs" value={meta[f.key] || ""} onChange={(e) => setMeta({ ...meta, [f.key]: e.target.value })} />;
  };

  return (
    <div className="border border-stone-200 rounded-xl p-3 bg-white">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-stone-400 shrink-0" />
          <div className="text-sm font-semibold text-stone-800 truncate">{cfg.label}</div>
        </div>
        {existing && (
          <div className="flex items-center gap-1">
            <button onClick={download} className="p-1 text-stone-500 hover:text-stone-800"><Download className="w-3.5 h-3.5" /></button>
            <button onClick={remove} className="p-1 text-stone-500 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </div>
      {cfg.meta && (
        <div className="mt-2 grid grid-cols-1 gap-1.5">
          {cfg.meta.map((f) => <div key={f.key}><div className="text-[10px] text-stone-500 mb-0.5">{f.label}</div>{renderField(f)}</div>)}
        </div>
      )}
      {existing ? (
        <div className="mt-2 text-[11px] text-stone-500 truncate">📎 {existing.original_filename}</div>
      ) : (
        <>
          <input ref={inp} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <Button size="sm" variant="outline" className="w-full mt-3 h-8 text-xs" onClick={() => inp.current?.click()} disabled={uploading} data-testid={`upload-${cfg.key}`}>
            {uploading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Upload className="w-3 h-3 mr-1" />} Upload
          </Button>
        </>
      )}
    </div>
  );
}

function DocumentDropdown({ title, children }) {
  return (
    <details className="group border border-stone-200 rounded-xl bg-white overflow-hidden">
      <summary className="cursor-pointer list-none flex items-center justify-between px-4 py-4 hover:bg-stone-50">
        <span className="font-display font-semibold text-base text-stone-800">
          {title}
        </span>

        <span className="text-stone-500 text-sm transition-transform group-open:rotate-180">
          ▼
        </span>
      </summary>

      <div className="border-t border-stone-200 p-4">
        {children}
      </div>
    </details>
  );
}

export default function LeadDocuments({ lead, onUpdate, mode = "study" }) {
  const [docs, setDocs] = useState([]);
  const [qual, setQual] = useState(lead.highest_qualification || "");

  const [eptType, setEptType] = useState("");
  const [eptScore, setEptScore] = useState("");

  const load = async () => { const { data } = await api.get(`/leads/${lead.id}/documents`); setDocs(data); };
  useEffect(() => { load(); }, [lead.id]);

  const saveQual = async (v) => {
    setQual(v);
    await api.patch(`/leads/${lead.id}/extras`, { highest_qualification: v });
    toast.success("Qualification updated");
    onUpdate?.();
  };

  const isLoan = mode === "loan";
  const docsFor = isLoan ? LOAN_DOCS : (qual ? BASE_DOCS.filter((d) => d.qual.includes(qual)) : []);

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-xl">{isLoan ? "Loan Documents" : "Documents"}</h3>
        {!isLoan && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Highest Qualification</span>
            <Select value={qual} onValueChange={saveQual}>
              <SelectTrigger className="w-44 h-9 text-sm" data-testid="highest-qual-select"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="12th">12th Completed</SelectItem>
                <SelectItem value="UG">UG Completed</SelectItem>
                <SelectItem value="PG">PG Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {!isLoan && !qual && <div className="text-sm text-stone-400 py-8 text-center border-2 border-dashed border-stone-200 rounded-xl">Select highest qualification to unlock the document checklist.</div>}

      {docsFor.length > 0 && (
  <div className="space-y-3">

    

    {docsFor
      .filter((cfg) => cfg.key === "10th")
      .map((cfg) => {
        const existing = docs.find((d) => d.doc_type === cfg.key);

        return (
          <DocumentDropdown key={cfg.key} title="10th Certificate">
            <DocSlot
              leadId={lead.id}
              cfg={cfg}
              existing={existing}
              onChange={load}
            />
          </DocumentDropdown>
        );
      })}

    {docsFor
  .filter((cfg) => cfg.key === "12th")
  .map((cfg) => {
    const existing = docs.find((d) => d.doc_type === cfg.key);

    return (
      <DocumentDropdown key={cfg.key} title="12th / Diploma Certificate">
        <DocSlot
          leadId={lead.id}
          cfg={cfg}
          existing={existing}
          onChange={load}
        />
      </DocumentDropdown>
    );
  })}

{docsFor.some((cfg) =>
  ["ug_sem", "ug_transcript", "ug_degree", "ug_grading"].includes(cfg.key)
) && (
  <DocumentDropdown title="UG">
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {docsFor
        .filter((cfg) =>
          ["ug_sem", "ug_transcript", "ug_degree", "ug_grading"].includes(cfg.key)
        )
        .map((cfg) => {
          const existing = docs.find((d) => d.doc_type === cfg.key);

          return (
            <DocSlot
              key={cfg.key}
              leadId={lead.id}
              cfg={cfg}
              existing={existing}
              onChange={load}
            />
          );
        })}
    </div>
  </DocumentDropdown>
)}

{docsFor
  .filter((cfg) => cfg.key === "passport")
  .map((cfg) => {
    const existing = docs.find((d) => d.doc_type === cfg.key);

    return (
      <DocumentDropdown key={cfg.key} title="Passport">
        <DocSlot
          leadId={lead.id}
          cfg={cfg}
          existing={existing}
          onChange={load}
        />
      </DocumentDropdown>
    );
  })}

  

<div className="border border-stone-200 rounded-xl p-4 bg-white">
  <div className="text-sm font-semibold text-stone-800 mb-3">
    English Proficiency <span className="text-red-500">*</span>
  </div>

  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
    {[
      "IELTS",
      "PTE",
      "TOEFL",
      "Duolingo",
      "EPT Waiver",
      "Will Provide Later",
    ].map((type) => (
      <label
        key={type}
        className="flex items-center gap-2 cursor-pointer text-sm"
      >
        <input
          type="radio"
          name="english-test"
          value={type}
          checked={eptType === type}
          onChange={() => setEptType(type)}
        />
        {type}
      </label>
    ))}
  </div>
</div>

    {["IELTS", "PTE", "TOEFL", "Duolingo"].includes(eptType) && (
  <div className="border border-stone-200 rounded-xl p-4 bg-white">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

      <div>
        <label className="text-xs font-medium text-stone-600">
          Overall Score <span className="text-red-500">*</span>
        </label>

        <Input
          className="mt-1"
          placeholder="Enter Overall Score"
          value={eptScore}
          onChange={(e) => setEptScore(e.target.value)}
        />
      </div>

      <div>
        <label className="text-xs font-medium text-stone-600">
          Upload Report <span className="text-red-500">*</span>
        </label>

        <div className="mt-1">
          <DocSlot
            leadId={lead.id}
            cfg={docsFor.find((d) => d.key === "ept")}
            existing={docs.find((d) => d.doc_type === "ept")}
            onChange={load}
          />
        </div>
      </div>

    </div>
  </div>
)}

{eptType === "EPT Waiver" && (
  <div className="border border-stone-200 rounded-xl p-4 bg-white">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

      <div>
        <label className="text-xs font-medium text-stone-600">
          12th English Score <span className="text-red-500">*</span>
        </label>

        <Input
          className="mt-1"
          placeholder="Enter 12th English Score"
          value={eptScore}
          onChange={(e) => setEptScore(e.target.value)}
        />
      </div>

      <div>
        <label className="text-xs font-medium text-stone-600">
          Upload 12th Marksheet <span className="text-red-500">*</span>
        </label>

        <div className="mt-1">
          <DocSlot
            leadId={lead.id}
            cfg={docsFor.find((d) => d.key === "ept")}
            existing={docs.find((d) => d.doc_type === "ept")}
            onChange={load}
          />
        </div>
      </div>

    </div>
  </div>
)}
    
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {docsFor
        .filter(
  (cfg) =>
    ![
      "10th",
      "12th",
      "ug_sem",
      "ug_transcript",
      "ug_degree",
      "passport",
      "ept",
      "ug_grading",
    ].includes(cfg.key)
)
        .map((cfg) => {
          const existing = docs.find((d) => d.doc_type === cfg.key);

          return (
            <DocSlot
              key={cfg.key}
              leadId={lead.id}
              cfg={cfg}
              existing={existing}
              onChange={load}
            />
          );
        })}
    </div>

  </div>
)}
          </div>
  );
}
