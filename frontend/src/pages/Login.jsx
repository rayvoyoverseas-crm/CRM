import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function Login() {
  const { user, login, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (user === null) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin" /></div>;
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await login(email, password);
    setLoading(false);
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-5 bg-[#F9F8F6]">
      <div className="lg:col-span-3 relative hidden lg:block overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1779733263861-8ee442f6a1f2?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDB8MHwxfHNlYXJjaHwzfHxzdHVkeSUyMGFicm9hZCUyMHVuaXZlcnNpdHklMjBjYW1wdXMlMjBhcmNoaXRlY3R1cmV8ZW58MHx8fHwxNzgzMzcyMjgyfDA&ixlib=rb-4.1.0&q=85"
          alt="Campus"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-stone-900/70 via-stone-900/30 to-transparent" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <div className="inline-block px-3 py-1 rounded-full bg-white/15 backdrop-blur text-[11px] uppercase tracking-widest font-semibold border border-white/20 mb-4">
            Rayvoy Overseas · CRM
          </div>
          <h2 className="font-display font-bold text-4xl leading-tight max-w-xl">
            Move every student from first enquiry to enrollment — with clarity.
          </h2>
          <p className="text-white/80 mt-3 max-w-lg text-sm leading-relaxed">
            Track leads across Study Abroad, Accommodation, and Education Loan pipelines. Assign counsellors. Hit monthly targets.
          </p>
        </div>
      </div>

      <div className="lg:col-span-2 grid place-items-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#C05B43] text-white grid place-items-center font-display font-bold">R</div>
            <div className="font-display font-bold text-lg">Rayvoy Overseas</div>
          </div>
          <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-2">Welcome back</div>
          <h1 className="font-display font-bold text-4xl text-stone-900 tracking-tight leading-tight">Sign in to your CRM</h1>
          <p className="text-stone-500 mt-2 text-sm">Enter your admin or counsellor credentials.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4" data-testid="login-form">
            <div>
              <label className="text-xs font-medium text-stone-600 tracking-wide">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="login-email-input"
                className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#C05B43]/25 focus:border-[#C05B43] outline-none transition"
                placeholder="admin@rayvoyoverseas.com"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 tracking-wide">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="login-password-input"
                className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#C05B43]/25 focus:border-[#C05B43] outline-none transition"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2" data-testid="login-error">{error}</div>
            )}
            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit-button"
              className="w-full bg-[#C05B43] hover:bg-[#A64D37] text-white rounded-xl px-4 py-2.5 font-semibold text-sm shadow-sm transition-all disabled:opacity-70 inline-flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Sign In
            </button>
          </form>

          <div className="mt-8 text-[11px] text-stone-400 leading-relaxed">
            © {new Date().getFullYear()} Rayvoy Overseas. Internal use only.
          </div>
        </div>
      </div>
    </div>
  );
}
