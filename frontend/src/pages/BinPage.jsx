import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { Link, Navigate } from "react-router-dom";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import StageBadge from "@/components/StageBadge";

export default function BinPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const load = async () => setLeads((await api.get("/leads/bin/list")).data);
  useEffect(() => { load(); }, []);
  if (user && user.role !== "admin") return <Navigate to="/" replace />;

  const restore = async (l) => { await api.post(`/leads/${l.id}/restore`); toast.success("Restored"); load(); };
  const permDelete = async (l) => {
    if (!window.confirm(`Permanently delete ${l.name}? This cannot be undone.`)) return;
    await api.delete(`/leads/${l.id}/permanent`); toast.success("Deleted permanently"); load();
  };

  return (
    <Layout title="Bin" subtitle="Deleted leads — restore or delete permanently.">
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-widest text-stone-500 bg-stone-50 border-b border-stone-200">
              <th className="text-left px-6 py-3">Name</th>
              <th className="text-left px-6 py-3">Pipeline</th>
              <th className="text-left px-6 py-3">Stage</th>
              <th className="text-left px-6 py-3">Deleted</th>
              <th className="text-right px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-b border-stone-100" data-testid={`bin-row-${l.id}`}>
                <td className="px-6 py-4 font-semibold text-stone-800">{l.name}<div className="text-xs text-stone-500">{l.email || l.phone}</div></td>
                <td className="px-6 py-4 capitalize text-sm">{l.pipeline?.replace("_", " ")}</td>
                <td className="px-6 py-4"><StageBadge pipeline={l.pipeline} stage={l.stage} /></td>
                <td className="px-6 py-4 text-xs text-stone-500">{new Date(l.updated_at).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-right">
                  <Button size="sm" variant="outline" onClick={() => restore(l)} data-testid={`restore-${l.id}`} className="mr-2"><RotateCcw className="w-3.5 h-3.5 mr-1" /> Restore</Button>
                  <Button size="sm" variant="destructive" onClick={() => permDelete(l)} data-testid={`perm-delete-${l.id}`}><Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Permanently</Button>
                </td>
              </tr>
            ))}
            {leads.length === 0 && <tr><td colSpan={5} className="text-center py-16 text-sm text-stone-400">Bin is empty.</td></tr>}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
