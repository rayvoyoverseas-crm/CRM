import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

export default api;

export const COUNTRIES = ["UK", "USA", "Canada", "Ireland", "Germany", "Australia", "New Zealand", "France", "Poland", "Malta", "Spain", "Other EU", "Korea", "Japan", "China", "India", "Singapore", "Malaysia", "Other"];

export const STAGE_MAP = {
  study_abroad: {
    NL: { label: "New Lead", classes: "bg-sky-50 text-sky-700 ring-sky-600/20" },
    CC: { label: "Counsellor Contacted", classes: "bg-blue-50 text-blue-700 ring-blue-600/20" },
    DNP: { label: "Did Not Respond", classes: "bg-rose-50 text-rose-700 ring-rose-600/20" },
    SL: { label: "Shortlisting", classes: "bg-slate-100 text-slate-700 ring-slate-600/20" },
    DR: { label: "Docs Received", classes: "bg-stone-100 text-stone-800 ring-stone-600/20" },
    PR: { label: "Prospect", classes: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
    RA: { label: "Ready to Application", classes: "bg-amber-50 text-amber-800 ring-amber-600/20" },
    AP: { label: "Application", classes: "bg-orange-50 text-orange-800 ring-orange-600/20" },
    OL: { label: "Offer Letter", classes: "bg-green-50 text-green-800 ring-green-600/20" },
    RD: { label: "Ready to Deposit", classes: "bg-yellow-50 text-yellow-900 ring-yellow-600/30" },
    DP: { label: "Deposit Paid", classes: "bg-[#C05B43]/10 text-[#8a3f2c] ring-[#C05B43]/30" },
    VS: { label: "Visa", classes: "bg-cyan-50 text-cyan-800 ring-cyan-600/20" },
    EN: { label: "Enrollment", classes: "bg-[#1B365D]/10 text-[#1B365D] ring-[#1B365D]/30" },
    LO: { label: "Lost", classes: "bg-red-100 text-red-800 ring-red-600/30" },
    DF: { label: "Deferred", classes: "bg-purple-50 text-purple-800 ring-purple-600/20" },
  },
  accommodation: {
    IN: { label: "Inquiry", classes: "bg-sky-50 text-sky-700 ring-sky-600/20" },
    OS: { label: "Options Sent", classes: "bg-amber-50 text-amber-800 ring-amber-600/20" },
    VS: { label: "Viewing / Shortlist", classes: "bg-orange-50 text-orange-800 ring-orange-600/20" },
    BK: { label: "Booking", classes: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
    CF: { label: "Confirmed", classes: "bg-green-100 text-green-800 ring-green-600/30" },
  },
  loan: {
    AS: { label: "Application Started", classes: "bg-slate-50 text-slate-700 ring-slate-600/20" },
    DS: { label: "Docs Submitted", classes: "bg-blue-50 text-blue-700 ring-blue-600/20" },
    PR: { label: "Processing", classes: "bg-amber-50 text-amber-800 ring-amber-600/20" },
    AP: { label: "Approved", classes: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
    DB: { label: "Disbursed", classes: "bg-[#1B365D]/10 text-[#1B365D] ring-[#1B365D]/30" },
  },
};

export const PIPELINE_STAGES = {
  study_abroad: ["NL", "CC", "DNP", "SL", "DR", "PR", "RA", "AP", "OL", "RD", "DP", "VS", "EN", "LO", "DF"],
  accommodation: ["IN", "OS", "VS", "BK", "CF"],
  loan: ["AS", "DS", "PR", "AP", "DB"],
};

export const PIPELINE_LABELS = {
  study_abroad: "Study Abroad",
  accommodation: "Accommodation",
  loan: "Education Loan",
};
