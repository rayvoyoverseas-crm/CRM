import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api, { PIPELINE_STAGES, STAGE_MAP, COUNTRIES } from "@/lib/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export default function LeadDialog({ open, onOpenChange, pipeline, onCreated, defaultSource = "website" }) {
  const { user } = useAuth();
const isCounsellor = user?.role === "counsellor";
  
const [form, setForm] = useState({
  name: "",
  email: "",
  phone: "",
  country_interest: "",
  course_interest: "",
  intake: "",
  source: defaultSource,
  notes: "",
  assigned_to: "",
});
  
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [phoneError, setPhoneError] =
    useState("");

  useEffect(() => {
  if (!open) return;

  setForm({
    name: "",
    email: "",
    phone: "",
    country_interest: "",
    course_interest: "",
    intake: "",
    source: isCounsellor ? "referral" : defaultSource,
    notes: "",
    assigned_to: isCounsellor ? user.id : "",
  });

  if (!isCounsellor) {
    api.get("/users").then((r) => setUsers(r.data)).catch(() => {});
  }
}, [open, defaultSource, isCounsellor, user]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (
      !form.email.trim() &&
      !form.phone.trim()
    ) {
      toast.error(
        "Please enter an email address or phone number."
      );
      return;
    }
    if (phoneError) {
      toast.error(
        "Please enter a valid phone number with country code."
      );
      return;
    }
    if (
      pipeline === "study_abroad" &&
      !form.intake
    ) {
      toast.error("Intake is required");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, pipeline };
      if (!payload.assigned_to) delete payload.assigned_to;
      const { data } = await api.post("/leads", payload);
      toast.success("Lead created");
      onCreated?.(data);
      onOpenChange(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create lead");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="lead-create-dialog">
        <DialogHeader><DialogTitle className="font-display text-2xl">New Lead · {pipeline.replace("_", " ")}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label className="text-xs">Full Name *</Label>
            <Input data-testid="lead-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Email</Label>
              <Input data-testid="lead-email-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">
                Phone
              </Label>
            
              <Input
                data-testid="lead-phone-input"
                value={form.phone}
                placeholder="+919876543210"
                onChange={(e) => {
                  const value = e.target.value;
            
                  setForm({
                    ...form,
                    phone: value,
                  });
            
                  const clean = value.replace(
                    /[\s\-()]/g,
                    ""
                  );
            
                  if (!clean) {
                    setPhoneError("");
                    return;
                  }
            
                  if (!clean.startsWith("+")) {
                    setPhoneError(
                      "Add country code. Example: +919876543210"
                    );
                    return;
                  }
            
                  const digits =
                    clean.slice(1);
            
                  if (
                    !/^\d+$/.test(digits)
                  ) {
                    setPhoneError(
                      "Phone number can contain numbers only."
                    );
                    return;
                  }
            
                  if (
                    digits.length < 11 ||
                    digits.length > 13
                  ) {
                    setPhoneError(
                      "Enter country code + exactly 10-digit phone number."
                    );
                    return;
                  }
            
                  setPhoneError("");
                }}
                className={
                  phoneError
                    ? "border-red-500 focus-visible:ring-red-500"
                    : ""
                }
              />
            
              {phoneError && (
                <p className="text-xs text-red-600 mt-1">
                  {phoneError}
                </p>
              )}
            </div>
          </div>
          {pipeline === "study_abroad" && (
            <div className="grid grid-cols-2 gap-3">
          
              {/* Country */}
              <div>
                <Label className="text-xs">
                  Country Interest
                </Label>
          
                <Select
                  value={form.country_interest}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      country_interest: v,
                    })
                  }
                >
                  <SelectTrigger data-testid="lead-country-select">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
          
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
          
              {/* Course */}
              <div>
                <Label className="text-xs">
                  Course Interest
                </Label>
          
                <Input
                  value={form.course_interest}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      course_interest: e.target.value,
                    })
                  }
                />
              </div>
          
              {/* Intake */}
              <div className="col-span-2">
                <Label className="text-xs">
                  Intake *
                </Label>
          
                <Select
                  value={form.intake}
                  onValueChange={(value) =>
                    setForm({
                      ...form,
                      intake: value,
                    })
                  }
                >
                  <SelectTrigger data-testid="lead-intake-select">
                    <SelectValue placeholder="Select intake" />
                  </SelectTrigger>
          
                  <SelectContent>
                    <SelectItem value="September 2026">
                      September 2026
                    </SelectItem>
          
                    <SelectItem value="January 2027">
                      January 2027
                    </SelectItem>
          
                    <SelectItem value="September 2027">
                      September 2027
                    </SelectItem>
          
                    <SelectItem value="January 2028">
                      January 2028
                    </SelectItem>
          
                    <SelectItem value="September 2028">
                      September 2028
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
          
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
           <div>
  <Label className="text-xs">Source</Label>

  {isCounsellor ? (
    <Input
      value="Referral"
      disabled
      className="bg-stone-50"
    />
  ) : (
    <Select
      value={form.source}
      onValueChange={(v) => setForm({ ...form, source: v })}
    >
      <SelectTrigger data-testid="lead-source-select">
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="website">Website</SelectItem>
        <SelectItem value="referral">Referral</SelectItem>
        <SelectItem value="walk-in">Walk-in</SelectItem>
        <SelectItem value="social">Social Media</SelectItem>
      </SelectContent>
    </Select>
  )}
</div>
           <div>
  <Label className="text-xs">Assign To</Label>

  {isCounsellor ? (
    <Input
      value={user?.name || ""}
      disabled
      className="bg-stone-50"
    />
  ) : (
    <Select
      value={form.assigned_to || "__none__"}
      onValueChange={(v) =>
        setForm({
          ...form,
          assigned_to: v === "__none__" ? "" : v,
        })
      }
    >
      <SelectTrigger data-testid="lead-assignee-select">
        <SelectValue placeholder="Unassigned" />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="__none__">Unassigned</SelectItem>

        {users.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            {u.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )}
</div>
  </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving} data-testid="lead-submit-button" className="bg-[#C05B43] hover:bg-[#A64D37]">
              {saving ? "Creating..." : "Create Lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
