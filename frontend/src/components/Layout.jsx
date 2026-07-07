import React from "react";
import Sidebar from "@/components/Sidebar";
import { Toaster } from "@/components/ui/sonner";
import NotificationBell from "@/components/NotificationBell";

export default function Layout({ children, title, subtitle, actions }) {
  return (
    <div className="min-h-screen flex bg-[#F9F8F6]">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-10 bg-[#F9F8F6]/85 backdrop-blur border-b border-stone-200/60 px-8 py-5 flex items-start justify-between gap-6">
          <div>
            <h1 className="font-display font-bold text-[26px] text-stone-900 tracking-tight leading-tight" data-testid="page-title">{title}</h1>
            {subtitle && <p className="text-sm text-stone-500 mt-1">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <NotificationBell />
          </div>
        </header>
        <div className="px-8 py-6">{children}</div>
        <Toaster position="top-right" richColors />
      </main>
    </div>
  );
}
