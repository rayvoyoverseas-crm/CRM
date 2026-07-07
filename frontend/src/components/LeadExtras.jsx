import React, { useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

export function LeadReferees({ lead, onUpdate }) {
  const [refs, setRefs] = useState(lead.referees || []);
  const [form, setForm] = useState({ name: "", profession: "", relationship: "", phone: "", email: "" });

  const save = async (list) => {
    setRefs(list);
    await api.patch(`/leads/${lead.id}/extras`, { referees: list });
    onUpdate?.();
  };

  const add = () => {
    if (!form.name) { toast.error("Name required"); return; }
    save([...refs, form]);
    setForm({ name: "", profession: "", relationship: "", phone: "", email: "" });
    toast.success("Referee added");
  };

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6">
      <h3 className="font-display font-semibold text-lg flex items-center gap-2 mb-4"><UserPlus className="w-4 h-4 text-[#C05B43]" /> LOR / Referee Details</h3>
      <div className="space-y-2 mb-4">
        {refs.map((r, i) => (
          <div key={i} className="flex items-center gap-3 border border-stone-100 rounded-xl p-3">
            <div className="flex-1">
              <div className="text-sm font-semibold text-stone-800">{r.name} <span className="text-xs text-stone-400 font-normal">· {r.profession}</span></div>
              <div className="text-[11px] text-stone-500">{r.relationship} · {r.phone} · {r.email}</div>
            </div>
            <button onClick={() => save(refs.filter((_, x) => x !== i))} className="text-stone-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-stone-100 pt-4">
        <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="ref-name" />
        <Input placeholder="Profession" value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} />
        <Input placeholder="Relationship" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} />
        <Input placeholder="Contact No" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Input placeholder="Email" className="col-span-2" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Button size="sm" onClick={add} className="col-span-2 bg-[#1B365D]" data-testid="ref-add"><Plus className="w-4 h-4 mr-1" /> Add Referee</Button>
      </div>
    </div>
  );
}

export function LeadLoanInfo({ lead, onUpdate }) {
  const [info, setInfo] = useState(lead.loan_info || {});
  const save = async () => {
    await api.patch(`/leads/${lead.id}/extras`, { loan_info: info });
    toast.success("Loan info saved");
    onUpdate?.();
  };
  const fields = [
    ["applicant_name", "Applicant Name"],
    ["co_applicant_name", "Co-Applicant Name"],
    ["co_applicant_relationship", "Co-Applicant Relationship"],
    ["cibil_score", "CIBIL Score"],
    ["loan_amount", "Loan Amount Required"],
    ["annual_income", "Family Annual Income"],
    ["preferred_bank", "Preferred Bank"],
    ["collateral", "Collateral Available (Y/N + details)"],
  ];
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6">
      <h3 className="font-display font-semibold text-lg mb-4">Education Loan Details</h3>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(([k, l]) => (
          <div key={k}><Label className="text-xs">{l}</Label><Input value={info[k] || ""} onChange={(e) => setInfo({ ...info, [k]: e.target.value })} data-testid={`loan-${k}`} /></div>
        ))}
      </div>
      <div className="mt-4 flex justify-end"><Button onClick={save} className="bg-[#C05B43]" data-testid="loan-save">Save Loan Info</Button></div>
    </div>
  );
}
