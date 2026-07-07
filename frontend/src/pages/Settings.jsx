import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { Copy, Check, Globe2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";

export default function Settings() {
  const { user } = useAuth();
  const [cfg, setCfg] = useState(null);
  const [copied, setCopied] = useState("");

  useEffect(() => { if (user?.role === "admin") api.get("/config/webhook").then((r) => setCfg(r.data)); }, [user]);
  if (user && user.role !== "admin") return <Navigate to="/" replace />;

  const copy = (val, key) => {
    navigator.clipboard.writeText(val);
    setCopied(key);
    toast.success("Copied");
    setTimeout(() => setCopied(""), 1500);
  };

  const curlSample = cfg && `curl -X POST '${cfg.endpoint}' \\
  -H 'Content-Type: application/json' \\
  -H 'X-API-Key: ${cfg.api_key}' \\
  -d '${JSON.stringify(cfg.body_example)}'`;

  return (
    <Layout title="Integrations" subtitle="Connect your website form to your CRM.">
      <div className="max-w-3xl">
        <div className="bg-white border border-stone-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#C05B43]/10 text-[#C05B43] grid place-items-center"><Globe2 className="w-5 h-5" /></div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Website Lead Capture</div>
              <h3 className="font-display font-semibold text-xl">rayvoyoverseas.com → CRM</h3>
            </div>
          </div>
          <p className="text-sm text-stone-600">Add this endpoint to your website enquiry form. Every submission will land in the Website Leads inbox for triage.</p>

          {cfg && (
            <div className="mt-5 space-y-3">
              <Row label="Endpoint" value={cfg.endpoint} onCopy={() => copy(cfg.endpoint, "ep")} copied={copied === "ep"} testId="webhook-endpoint" />
              <Row label="Method" value={cfg.method} />
              <Row label="Header: X-API-Key" value={cfg.api_key} onCopy={() => copy(cfg.api_key, "key")} copied={copied === "key"} secret testId="webhook-api-key" />
              <div>
                <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-2">JSON Body</div>
                <pre className="bg-stone-900 text-stone-100 rounded-xl p-4 text-xs overflow-x-auto">{JSON.stringify(cfg.body_example, null, 2)}</pre>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Test with cURL</div>
                  <button onClick={() => copy(curlSample, "curl")} className="text-xs text-[#C05B43] font-semibold inline-flex items-center gap-1 hover:underline">
                    {copied === "curl" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copy
                  </button>
                </div>
                <pre className="bg-stone-900 text-stone-100 rounded-xl p-4 text-xs overflow-x-auto whitespace-pre-wrap">{curlSample}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function Row({ label, value, onCopy, copied, secret, testId }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-1">{label}</div>
      <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
        <code className="text-xs text-stone-800 flex-1 truncate" data-testid={testId}>{secret ? "•".repeat(Math.min(value.length, 24)) + value.slice(-4) : value}</code>
        {onCopy && (
          <button onClick={onCopy} className="text-stone-500 hover:text-stone-800 p-1 rounded-md hover:bg-white transition-colors">
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
