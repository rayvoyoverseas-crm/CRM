import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import PipelineBoard from "@/pages/PipelineBoard";
import WebsiteLeads from "@/pages/WebsiteLeads";
import Analytics from "@/pages/Analytics";
import Team from "@/pages/Team";
import Targets from "@/pages/Targets";
import Settings from "@/pages/Settings";
import LeadDetail from "@/pages/LeadDetail";
import { Loader2 } from "lucide-react";

function Protected({ children }) {
  const { user } = useAuth();
  if (user === null) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-stone-400" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/pipeline/study" element={<Protected><PipelineBoard pipeline="study_abroad" /></Protected>} />
          <Route path="/pipeline/accommodation" element={<Protected><PipelineBoard pipeline="accommodation" /></Protected>} />
          <Route path="/pipeline/loan" element={<Protected><PipelineBoard pipeline="loan" /></Protected>} />
          <Route path="/website-leads" element={<Protected><WebsiteLeads /></Protected>} />
          <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
          <Route path="/team" element={<Protected><Team /></Protected>} />
          <Route path="/targets" element={<Protected><Targets /></Protected>} />
          <Route path="/settings" element={<Protected><Settings /></Protected>} />
          <Route path="/lead/:id" element={<Protected><LeadDetail /></Protected>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
