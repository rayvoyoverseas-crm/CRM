import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Users2, Home, Landmark, Globe, BarChart3, UserCog, Target, LogOut, Settings2, Trash2,
} from "lucide-react";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testId: "nav-dashboard", perm: null },
  { to: "/pipeline/study", label: "Study Abroad", icon: Users2, testId: "nav-study", perm: null },
  { to: "/pipeline/accommodation", label: "Accommodation", icon: Home, testId: "nav-accom", perm: null },
  { to: "/pipeline/loan", label: "Education Loan", icon: Landmark, testId: "nav-loan", perm: null },
  { to: "/website-leads", label: "Website Leads", icon: Globe, testId: "nav-website", perm: "see_website_leads" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, testId: "nav-analytics", perm: "see_analytics" },
  { to: "/tasks", label: "My Tasks", icon: Users2, testId: "nav-tasks", perm: null },
];

const adminNav = [
  { to: "/team", label: "Team", icon: UserCog, testId: "nav-team", perm: "see_team" },
  { to: "/targets", label: "Targets", icon: Target, testId: "nav-targets", perm: "see_targets" },
  { to: "/bin", label: "Bin", icon: Trash2, testId: "nav-bin", perm: null },
  { to: "/settings", label: "Integrations", icon: Settings2, testId: "nav-settings", perm: "see_integrations" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <aside className="w-64 shrink-0 bg-[#F5F2ED] border-r border-stone-200 h-screen sticky top-0 flex flex-col">
      <div className="px-5 py-6 border-b border-stone-200/70">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[#C05B43] text-white grid place-items-center font-display font-bold text-lg">R</div>
          <div>
            <div className="font-display font-bold text-[15px] leading-tight text-stone-900">Rayvoy</div>
            <div className="text-[11px] text-stone-500 tracking-widest uppercase">Overseas CRM</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold px-2 mb-1.5">Workspace</div>
        {nav.filter((n) => !n.perm || user.role === "admin" || user.permissions?.[n.perm]).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            data-testid={n.testId}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                isActive
                  ? "bg-white border border-stone-200 text-[#C05B43] shadow-sm font-semibold"
                  : "text-stone-600 hover:bg-white/70 hover:text-stone-900"
              }`
            }
          >
            <n.icon className="w-4 h-4" strokeWidth={2} />
            <span>{n.label}</span>
          </NavLink>
        ))}

        {user.role === "admin" && (
          <>
            <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold px-2 mt-6 mb-1.5">Admin</div>
            {adminNav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                data-testid={n.testId}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                    isActive
                      ? "bg-white border border-stone-200 text-[#C05B43] shadow-sm font-semibold"
                      : "text-stone-600 hover:bg-white/70 hover:text-stone-900"
                  }`
                }
              >
                <n.icon className="w-4 h-4" strokeWidth={2} />
                <span>{n.label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="px-3 py-4 border-t border-stone-200/70">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-9 h-9 rounded-full bg-[#1B365D] text-white grid place-items-center text-sm font-semibold">
            {(user.name || user.email).slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-stone-800 truncate" data-testid="sidebar-user-name">{user.name}</div>
            <div className="text-[11px] text-stone-500 uppercase tracking-wider">{user.role}</div>
          </div>
          <button
            onClick={async () => { await logout(); navigate("/login"); }}
            data-testid="logout-button"
            className="p-2 rounded-lg text-stone-500 hover:text-[#C05B43] hover:bg-white transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
