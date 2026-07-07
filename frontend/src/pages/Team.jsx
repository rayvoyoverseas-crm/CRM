import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";

export default function Team() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "counsellor", password: "" });

  const load = async () => setUsers((await api.get("/users")).data);
  useEffect(() => { load(); }, []);

  if (user && user.role !== "admin") return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/users", form);
      toast.success("Team member added");
      setOpen(false);
      setForm({ name: "", email: "", phone: "", role: "counsellor", password: "" });
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const remove = async (u) => {
    if (!window.confirm(`Remove ${u.name}?`)) return;
    try { await api.delete(`/users/${u.id}`); toast.success("Removed"); load(); } catch (e) { toast.error("Failed"); }
  };

  const toggleActive = async (u) => {
    try { await api.patch(`/users/${u.id}`, { active: !u.active }); load(); } catch (e) { toast.error("Failed"); }
  };

  return (
    <Layout
      title="Team"
      subtitle="Manage counsellor accounts and access."
      actions={<Button onClick={() => setOpen(true)} data-testid="add-member-button" className="bg-[#C05B43] hover:bg-[#A64D37] rounded-xl"><Plus className="w-4 h-4 mr-1" /> Add Member</Button>}
    >
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-stone-500 bg-stone-50 border-b border-stone-200">
              <th className="text-left px-6 py-3">Member</th>
              <th className="text-left px-6 py-3">Role</th>
              <th className="text-left px-6 py-3">Permissions</th>
              <th className="text-left px-6 py-3">Status</th>
              <th className="text-right px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-stone-100" data-testid={`team-row-${u.id}`}>
                <td className="px-6 py-4 flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-[#1B365D] text-white grid place-items-center text-sm font-bold">{u.name?.slice(0, 1).toUpperCase()}</span>
                  <div>
                    <div className="font-semibold text-stone-800">{u.name}</div>
                    <div className="text-xs text-stone-500">{u.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ring-inset inline-flex items-center gap-1 ${u.role === "admin" ? "bg-[#1B365D]/10 text-[#1B365D] ring-[#1B365D]/30" : "bg-stone-100 text-stone-700 ring-stone-600/20"}`}>
                    {u.role === "admin" && <ShieldCheck className="w-3 h-3" />} {u.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-stone-600">
                  {u.role !== "admin" && (
                    <div className="flex flex-wrap gap-1">
                      {[
                        ["see_all_leads", "All leads"],
                        ["see_analytics", "Analytics"],
                        ["see_website_leads", "Website"],
                        ["see_targets", "Targets"],
                        ["see_team", "Team"],
                      ].map(([k, l]) => {
                        const on = u.permissions?.[k];
                        return (
                          <button
                            key={k}
                            onClick={async () => {
                              await api.patch(`/users/${u.id}`, { permissions: { ...u.permissions, [k]: !on } });
                              load();
                            }}
                            data-testid={`perm-${u.id}-${k}`}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ring-inset ${on ? "bg-emerald-50 text-emerald-700 ring-emerald-600/30" : "bg-stone-100 text-stone-500 ring-stone-300"}`}
                          >{l}</button>
                        );
                      })}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <button onClick={() => toggleActive(u)} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${u.active ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-rose-50 text-rose-700 ring-rose-600/20"}`}>
                    {u.active ? "Active" : "Disabled"}
                  </button>
                </td>
                <td className="px-6 py-4 text-right">
                  {u.id !== user?.id && (
                    <button onClick={() => remove(u)} data-testid={`remove-${u.id}`} className="text-stone-400 hover:text-rose-600 transition-colors p-2 rounded-lg hover:bg-rose-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display text-2xl">Add Team Member</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div><Label className="text-xs">Full Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="member-name" /></div>
            <div><Label className="text-xs">Email</Label><Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="member-email" /></div>
            <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div>
              <Label className="text-xs">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger data-testid="member-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="counsellor">Counsellor</SelectItem>
                  <SelectItem value="team_lead">Team Lead</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Temporary Password</Label><Input type="text" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="member-password" /></div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="member-submit" className="bg-[#C05B43] hover:bg-[#A64D37]">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
