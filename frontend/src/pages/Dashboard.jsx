import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api, { PIPELINE_LABELS } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { ArrowRight, Users2, TrendingUp, GraduationCap, Sparkles, Globe } from "lucide-react";
import StageBadge from "@/components/StageBadge";

function Kpi({ label, value, hint, icon: Icon, tone = "stone" }) {
  const toneMap = {
    stone: "bg-white text-stone-900 border-stone-200",
    terracotta: "bg-[#FFF6F2] text-[#7a3623] border-[#F0D3C6]",
    navy: "bg-[#F1F4F9] text-[#1B365D] border-[#D3DEEC]",
  };
  return (
    <div className={`rounded-2xl p-6 border ${toneMap[tone]} shadow-sm`}>
      <div className="flex items-start justify-between">
        <div className="text-[11px] uppercase tracking-widest text-stone-500 font-semibold">{label}</div>
        {Icon && <Icon className="w-4 h-4 text-stone-400" />}
      </div>
      <div className="mt-3 font-display font-bold text-4xl tracking-tight" data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value ?? "—"}</div>
      {hint && <div className="text-xs text-stone-500 mt-1.5">{hint}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [k, l] = await Promise.all([
          api.get("/analytics/kpis"),
          api.get("/leads", { params: { pipeline: "study_abroad" } }),
        ]);
        setKpis(k.data);
        setRecent(l.data.slice(0, 8));
      } catch (e) {}
    })();
  }, []);

  return (
    <Layout title={`Welcome, ${user?.name?.split(" ")[0] || "there"}`} subtitle="A quick pulse on your Study Abroad pipeline.">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <Kpi label="Total Leads" value={kpis?.total} hint="All time · Study Abroad" icon={Users2} />
        <Kpi label="Active Pipeline" value={kpis?.active} hint="Excludes DNP & enrolled" icon={Sparkles} tone="terracotta" />
        <Kpi label="Deposits" value={kpis?.deposits} hint={`Conversion: ${kpis?.conversion_pct ?? 0}%`} icon={TrendingUp} tone="navy" />
        <Kpi label="Enrollments" value={kpis?.enrollments} hint="Students onboarded" icon={GraduationCap} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-6">
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Recent Leads</div>
              <h3 className="font-display text-xl font-semibold mt-1">Latest activity</h3>
            </div>
            <Link to="/pipeline/study" className="text-xs text-[#C05B43] font-semibold inline-flex items-center gap-1 hover:gap-2 transition-all">
              View pipeline <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-stone-100">
            {recent.length === 0 && <div className="text-sm text-stone-500 py-8 text-center">No leads yet — add your first one.</div>}
            {recent.map((l) => (
              <Link
                key={l.id}
                to={`/lead/${l.id}`}
                data-testid={`recent-lead-${l.id}`}
                className="py-3.5 flex items-center gap-3 hover:bg-stone-50 rounded-lg px-2 -mx-2 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-stone-100 grid place-items-center text-stone-600 font-semibold text-sm">
                  {(l.name || "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-stone-800 truncate">{l.name}</div>
                  <div className="text-xs text-stone-500 truncate">{l.country_interest || "—"} · {l.course_interest || "Course TBD"}</div>
                </div>
                <StageBadge pipeline="study_abroad" stage={l.stage} />
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-[#1B365D] text-white rounded-2xl p-6 shadow-sm">
            <div className="text-[11px] uppercase tracking-widest text-white/60 font-semibold">This Month</div>
            <div className="mt-2 font-display font-bold text-5xl tracking-tight">{kpis?.new_this_month ?? 0}</div>
            <div className="text-sm text-white/80 mt-1">new leads created</div>
            <Link to="/analytics" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-white/90 hover:text-white">
              Open Analytics <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Website Inbox</div>
            <div className="mt-2 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#C05B43]/10 text-[#C05B43] grid place-items-center">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <div className="font-display font-bold text-2xl">{kpis?.unreviewed_website ?? 0}</div>
                <div className="text-xs text-stone-500">unreviewed website leads</div>
              </div>
            </div>
            <Link to="/website-leads" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#C05B43] hover:gap-2 transition-all">
              Review inbox <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
