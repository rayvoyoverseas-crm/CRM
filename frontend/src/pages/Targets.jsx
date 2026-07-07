import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Target as TargetIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";

const now = new Date();

export default function Targets() {
  const { user } = useAuth();
  const [targets, setTargets] = useState([]);
  const [form, setForm] = useState({
    period: "monthly", year: now.getFullYear(), month: now.getMonth() + 1,
    target_leads: 100, target_deposits: 20, target_enrollments: 10,
  });

  const load = async () => setTargets((await api.get("/targets")).data);
  useEffect(() => { load(); }, []);
  if (user && user.role !== "admin") return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/targets", {
        ...form,
        month: form.period === "monthly" ? form.month : null,
      });
      toast.success("Target saved");
      load();
    } catch (err) { toast.error("Failed"); }
  };

  return (
    <Layout title="Targets" subtitle="Set monthly and yearly targets for lead flow, deposits, and enrollments.">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <form onSubmit={submit} className="lg:col-span-1 bg-white border border-stone-200 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-[#C05B43]/10 text-[#C05B43] grid place-items-center"><TargetIcon className="w-4 h-4" /></div>
            <h3 className="font-display font-semibold text-lg">New Target</h3>
          </div>
          <div>
            <Label className="text-xs">Period</Label>
            <Select value={form.period} onValueChange={(v) => setForm({ ...form, period: v })}>
              <SelectTrigger data-testid="target-period"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Year</Label>
              <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
            </div>
            {form.period === "monthly" && (
              <div>
                <Label className="text-xs">Month</Label>
                <Input type="number" min={1} max={12} value={form.month} onChange={(e) => setForm({ ...form, month: Number(e.target.value) })} />
              </div>
            )}
          </div>
          <div><Label className="text-xs">Target Leads</Label><Input type="number" value={form.target_leads} onChange={(e) => setForm({ ...form, target_leads: Number(e.target.value) })} data-testid="target-leads" /></div>
          <div><Label className="text-xs">Target Deposits</Label><Input type="number" value={form.target_deposits} onChange={(e) => setForm({ ...form, target_deposits: Number(e.target.value) })} /></div>
          <div><Label className="text-xs">Target Enrollments</Label><Input type="number" value={form.target_enrollments} onChange={(e) => setForm({ ...form, target_enrollments: Number(e.target.value) })} /></div>
          <Button type="submit" data-testid="save-target" className="w-full bg-[#C05B43] hover:bg-[#A64D37]">Save Target</Button>
        </form>

        <div className="lg:col-span-2 space-y-3">
          {targets.map((t) => (
            <div key={t.id} className="bg-white border border-stone-200 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">{t.period}</div>
                  <div className="font-display font-semibold text-xl mt-1">
                    {t.period === "monthly" ? `${t.year}-${String(t.month).padStart(2, "0")}` : t.year}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-6 text-right">
                  <div><div className="text-[10px] uppercase tracking-widest text-stone-400">Leads</div><div className="font-display text-2xl font-bold text-[#C05B43]">{t.target_leads}</div></div>
                  <div><div className="text-[10px] uppercase tracking-widest text-stone-400">Deposits</div><div className="font-display text-2xl font-bold text-[#1B365D]">{t.target_deposits}</div></div>
                  <div><div className="text-[10px] uppercase tracking-widest text-stone-400">Enrollments</div><div className="font-display text-2xl font-bold text-emerald-700">{t.target_enrollments}</div></div>
                </div>
              </div>
            </div>
          ))}
          {targets.length === 0 && <div className="text-center text-sm text-stone-400 py-16 border-2 border-dashed border-stone-200 rounded-2xl bg-white">No targets set yet. Add one on the left.</div>}
        </div>
      </div>
    </Layout>
  );
}
