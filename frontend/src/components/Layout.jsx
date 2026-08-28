import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { Toaster } from "@/components/ui/sonner";
import NotificationBell from "@/components/NotificationBell";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Layout({ children, title, subtitle, actions }) {
  const navigate = useNavigate();
  const [rayaOpen, setRayaOpen] = useState(false);
  const [rayaListening, setRayaListening] = useState(false);
  const [rayaTranscript, setRayaTranscript] = useState("");
  const [rayaError, setRayaError] = useState("");

  const startRayaListening = () => {
    setRayaError("");
    setRayaTranscript("");
  
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
  
    if (!SpeechRecognition) {
      setRayaError(
        "Voice recognition is not supported in this browser."
      );
      return;
    }
  
    const recognition = new SpeechRecognition();
  
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
  
    recognition.onstart = () => {
      setRayaListening(true);
    };
  
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setRayaTranscript(transcript);
    };
  
    recognition.onerror = (event) => {
      setRayaListening(false);
  
      if (event.error === "not-allowed") {
        setRayaError(
          "Microphone permission was denied. Please allow microphone access."
        );
        return;
      }
  
      if (event.error === "no-speech") {
        setRayaError("I couldn't hear anything. Please try again.");
        return;
      }
  
      setRayaError("I couldn't understand that. Please try again.");
    };
  
    recognition.onend = () => {
      setRayaListening(false);
    };
  
    recognition.start();
  };
  
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
          
            {/* RAYA Voice Assistant */}
            <button
              type="button"
              onClick={() => setRayaOpen(true)}
              className="h-9 px-3 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 flex items-center gap-2 text-xs font-semibold text-[#1B365D] transition-colors"
              title="Open RAYA"
            >
            <span className="text-xl leading-none">🎙️</span>
            RAYA
            </button>
          
            <NotificationBell />
          </div>
        </header>
        <div className="px-8 py-6">{children}</div>
          {/* RAYA Assistant Panel */}
          {rayaOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
              <div className="w-[420px] max-w-[calc(100vw-32px)] bg-white border border-stone-200 rounded-2xl shadow-2xl overflow-hidden">
          
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
                  <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#1B365D] text-white grid place-items-center">
                    <span className="text-lg leading-none">🎙️</span>
                  </div>
          
                    <div>
                      <div className="font-display font-bold text-lg text-stone-900">
                        RAYA
                      </div>
          
                      <div className="text-[11px] text-stone-400">
                        Your Rayvoy Assistant
                      </div>
                    </div>
                  </div>
          
                  <button
                    type="button"
                    onClick={() => setRayaOpen(false)}
                    className="w-8 h-8 rounded-lg hover:bg-stone-100 grid place-items-center text-stone-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
          
                {/* Body */}
                <div className="p-6 text-center">
                  <div className="mx-auto w-16 h-16 rounded-full bg-[#C05B43]/10 grid place-items-center">
                    <span className="text-4xl leading-none">🎙️</span>
                  </div>
          
                  <div className="mt-4 font-semibold text-stone-800">
                    Hi, I'm RAYA
                  </div>
          
                  <div className="mt-1 text-sm text-stone-500">
                    Your voice assistant for Rayvoy CRM.
                  </div>

                  <button
                    type="button"
                    onClick={startRayaListening}
                    disabled={rayaListening}
                    className="mt-5 w-full h-11 rounded-xl bg-[#1B365D] hover:bg-[#152a4a] disabled:opacity-70 text-white text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <span className="text-xl leading-none">
                      {rayaListening ? "🔴" : "🎙️"}
                    </span>
                  
                    {rayaListening ? "Listening..." : "Start Listening"}
                  </button>

                  {rayaTranscript && (
                    <div className="mt-4 rounded-xl bg-stone-50 border border-stone-200 px-4 py-3 text-left">
                      <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide">
                        I heard
                      </div>
                  
                      <div className="mt-1 text-sm font-medium text-stone-800">
                        “{rayaTranscript}”
                      </div>
                    </div>
                  )}
                  
                  {rayaError && (
                    <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                      {rayaError}
                    </div>
                  )}
          
                  <div className="mt-4 text-[11px] text-stone-400">
                    Try saying: "Search for Manali"
                  </div>
                </div>
          
              </div>
            </div>
          )}

        <Toaster position="top-right" richColors />
      </main>
    </div>
  );
}
