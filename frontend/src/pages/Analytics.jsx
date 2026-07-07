import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api, { PIPELINE_LABELS, STAGE_MAP } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell } from "recharts";
import { useAuth } from "@/context/AuthContext";

export default function Analytics() {
  const { user } = useAuth();
  const [pipeline, setPipeline] = useState("study_abroad");
  const [days, setDays] = useState(30);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [counsellor, setCounsellor] = useState("__all__");
  const [source, setSource] = useState("__all__");
  const [summary, setSummary] = useState(null);
  const [performance, setPerformance] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => { if (user?.role === "admin") api.get("/users").then((r) => setUsers(r.data)); }, [user]);

  useEffect(() => {
    (async () => {
      const params = { pipeline, days };
      if (counsellor !== "__all__") params.counsellor = counsellor;
      if (source !== "__all__") params.source = source;
      const { data } = await api.get("/analytics/summary", { params });
      setSummary(data);
      if (user?.role === "admin") {
        const p = await api.get("/analytics/counsellor-performance", { params: { days } });
        setPerformance(p.data);
      }
    })();
  }, [pipeline, days, counsellor, source, user]);

  const cfg = STAGE_MAP[pipeline] || {};

  return (
    <Layout
      title="Analytics"
      subtitle="Track lead flow, stage conversions, and team performance."
      actions={
        <div className="flex items-center gap-2">
          <Select value={pipeline} onValueChange={setPipeline}>
            <SelectTrigger className="w-40 h-9 text-xs" data-testid="analytics-pipeline"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="study_abroad">Study Abroad</SelectItem>
              <SelectItem value="accommodation">Accommodation</SelectItem>
              <SelectItem value="loan">Education Loan</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-32 h-9 text-xs" data-testid="analytics-range"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="180">Last 6 months</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
              <SelectItem value="1825">All time</SelectItem>
            </SelectContent>
          </Select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} data-testid="analytics-from" className="h-9 text-xs border border-stone-200 rounded-lg px-2 bg-white" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} data-testid="analytics-to" className="h-9 text-xs border border-stone-200 rounded-lg px-2 bg-white" />
          {user?.role === "admin" && (
            <Select value={counsellor} onValueChange={setCounsellor}>
              <SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder="Counsellor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Counsellors</SelectItem>
                {users.map((u) => (<SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>))}
              </SelectContent>
            </Select>
          )}
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-32 h-9 text-xs"><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Sources</SelectItem>
              <SelectItem value="website">Website</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="referral">Referral</SelectItem>
              <SelectItem value="walk-in">Walk-in</SelectItem>
              <SelectItem value="social">Social</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Total Leads</div>
          <div className="font-display font-bold text-4xl mt-2" data-testid="analytics-total-leads">{summary?.total_leads ?? 0}</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Reached Final</div>
          <div className="font-display font-bold text-4xl mt-2">{summary?.funnel?.[summary?.funnel.length - 1]?.count ?? 0}</div>
        </div>
        <div className="bg-[#1B365D] text-white rounded-2xl p-5">
          <div className="text-[11px] uppercase tracking-widest text-white/60 font-semibold">Start → End Conv.</div>
          <div className="font-display font-bold text-4xl mt-2">
            {summary?.conversion_table?.[summary?.conversion_table.length - 1]?.conv_from_start_pct ?? 0}%
          </div>
        </div>
        <div className="bg-[#C05B43] text-white rounded-2xl p-5">
          <div className="text-[11px] uppercase tracking-widest text-white/70 font-semibold">Monthly Trend</div>
          <div className="font-display font-bold text-4xl mt-2">{summary?.monthly?.length ?? 0}</div>
          <div className="text-[11px] text-white/70 mt-1">active months</div>
        </div>
      </div>

      {/* Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-2xl p-6">
          <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Funnel</div>
          <h3 className="font-display text-xl font-semibold mt-1 mb-4">{PIPELINE_LABELS[pipeline]} · Stage-by-Stage</h3>
          <div className="space-y-2">
            {summary?.funnel?.map((f, i) => {
              const max = Math.max(...(summary.funnel.map((x) => x.count) || [1]), 1);
              const pct = (f.count / max) * 100;
              return (
                <div key={f.stage} className="flex items-center gap-3">
                  <div className="w-12 text-[11px] font-bold text-stone-500">{f.stage}</div>
                  <div className="flex-1 h-8 bg-stone-100 rounded-lg overflow-hidden">
                    <div className="h-full flex items-center px-2 text-white text-xs font-semibold rounded-lg" style={{ width: `${Math.max(pct, 3)}%`, background: i % 2 === 0 ? "#C05B43" : "#1B365D" }}>
                      {f.count}
                    </div>
                  </div>
                  <div className="w-32 text-xs text-stone-500 truncate">{cfg[f.stage]?.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-6">
          <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Monthly Leads</div>
          <h3 className="font-display text-xl font-semibold mt-1 mb-4">Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={summary?.monthly || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E5E4" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#78716C" }} />
              <YAxis tick={{ fontSize: 10, fill: "#78716C" }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E7E5E4", fontSize: 12 }} />
              <Bar dataKey="count" fill="#C05B43" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Conversion table */}
      <div className="bg-white border border-stone-200 rounded-2xl mt-5 overflow-hidden">
        <div className="p-6 pb-3">
          <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Stage-to-Stage Conversion</div>
          <h3 className="font-display text-xl font-semibold mt-1">How leads flow through each stage</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-stone-500 bg-stone-50 border-y border-stone-200">
              <th className="text-left px-6 py-3">Stage</th>
              <th className="text-left px-6 py-3">Label</th>
              <th className="text-right px-6 py-3">Reached</th>
              <th className="text-right px-6 py-3">Conv. from previous</th>
              <th className="text-right px-6 py-3">Conv. from start</th>
            </tr>
          </thead>
          <tbody>
            {summary?.conversion_table?.map((r) => (
              <tr key={r.stage} className="border-b border-stone-100">
                <td className="px-6 py-3 font-bold text-stone-700">{r.stage}</td>
                <td className="px-6 py-3 text-stone-600">{cfg[r.stage]?.label}</td>
                <td className="px-6 py-3 text-right font-semibold">{r.reached}</td>
                <td className="px-6 py-3 text-right">{r.conv_from_prev_pct}%</td>
                <td className="px-6 py-3 text-right">
                  <span className="px-2 py-0.5 rounded-full bg-[#C05B43]/10 text-[#8a3f2c] text-xs font-semibold">{r.conv_from_start_pct}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Counsellor performance */}
      {user?.role === "admin" && (
        <div className="bg-white border border-stone-200 rounded-2xl mt-5 overflow-hidden">
          <div className="p-6 pb-3">
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Team Leaderboard</div>
            <h3 className="font-display text-xl font-semibold mt-1">Counsellor performance</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-stone-500 bg-stone-50 border-y border-stone-200">
                <th className="text-left px-6 py-3">Counsellor</th>
                <th className="text-right px-6 py-3">Leads</th>
                <th className="text-right px-6 py-3">Deposits</th>
                <th className="text-right px-6 py-3">Enrollments</th>
                <th className="text-right px-6 py-3">Conversion</th>
              </tr>
            </thead>
            <tbody>
              {performance.map((p, i) => (
                <tr key={p.counsellor_id} className="border-b border-stone-100">
                  <td className="px-6 py-3.5 flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-[#1B365D] text-white grid place-items-center text-xs font-bold">{p.name?.slice(0, 1).toUpperCase()}</span>
                    <div>
                      <div className="font-semibold text-stone-800">{p.name}</div>
                      <div className="text-[10px] uppercase tracking-widest text-stone-400">{p.role}</div>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right font-semibold">{p.total_leads}</td>
                  <td className="px-6 py-3 text-right">{p.deposits}</td>
                  <td className="px-6 py-3 text-right">{p.enrollments}</td>
                  <td className="px-6 py-3 text-right"><span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold ring-1 ring-emerald-600/20">{p.conversion_pct}%</span></td>
                </tr>
              ))}
              {performance.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-stone-400 text-sm">No team members yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
