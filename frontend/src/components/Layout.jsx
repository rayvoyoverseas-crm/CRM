import React, { useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { Toaster } from "@/components/ui/sonner";
import NotificationBell from "@/components/NotificationBell";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";

export default function Layout({ children, title, subtitle, actions }) {
  const navigate = useNavigate();
  const [rayaOpen, setRayaOpen] = useState(false);
  const [rayaListening, setRayaListening] = useState(false);
  const [rayaTranscript, setRayaTranscript] = useState("");
  const [rayaError, setRayaError] = useState("");
  const [rayaResult, setRayaResult] = useState("");
  const rayaRecognitionRef = useRef(null);

  const [rayaEnabled, setRayaEnabled] = useState(() => {
    return localStorage.getItem("raya_enabled") === "true";
  });

  const toggleRaya = () => {
    setRayaEnabled((current) => {
      const next = !current;
  
      localStorage.setItem("raya_enabled", String(next));
  
      if (!next) {
        setRayaListening(false);
        setRayaTranscript("");
        setRayaResult("");
        setRayaError("");
        setRayaOpen(false);
      }
  
      return next;
    });
  };
  
  const handleRayaCommand = async (command) => {
    const cleanCommand = command.trim();
    const lowerCommand = cleanCommand.toLowerCase();
  
    setRayaResult("");
    setRayaError("");
  
    // HARD SAFETY RULE:
    // RAYA never performs delete actions for anyone, including Admin.
    if (
      lowerCommand.includes("delete") ||
      lowerCommand.includes("remove lead") ||
      lowerCommand.includes("trash lead")
    ) {
      setRayaResult(
        "Delete actions are not available through RAYA voice commands."
      );
      return;
    }
  
    // SEARCH / FIND / OPEN LEAD
    const searchMatch = cleanCommand.match(
      /^(search for|search|find|open)\s+(.+)$/i
    );
  
    if (searchMatch) {
      const leadName = searchMatch[2].trim();
  
      if (!leadName) {
        setRayaResult("Please tell me which lead you want to search for.");
        return;
      }
  
      try {
        const { data } = await api.get("/leads", {
          params: {
            search: leadName,
          },
        });
  
        if (!Array.isArray(data) || data.length === 0) {
          setRayaResult(`I couldn't find a lead named "${leadName}".`);
          return;
        }
  
        const exactMatches = data.filter(
          (lead) =>
            (lead.name || "").trim().toLowerCase() ===
            leadName.toLowerCase()
        );
  
        const matches = exactMatches.length > 0 ? exactMatches : data;
  
        if (matches.length > 1) {
          setRayaResult(
            `I found ${matches.length} leads matching "${leadName}". Please use the CRM search to choose the correct one for now.`
          );
          return;
        }
  
        const lead = matches[0];
  
        const leadRouteId = lead.lead_code
          ? lead.lead_code.replace("/", "-")
          : lead.id;
  
        setRayaResult(`Opening ${lead.name}...`);
  
        setTimeout(() => {
          setRayaOpen(false);
          navigate(`/lead/${leadRouteId}`);
        }, 600);
  
        return;
      } catch (error) {
        setRayaError("I couldn't search the CRM right now.");
        return;
      }
    }
  
    setRayaResult(
      `I heard "${cleanCommand}", but I don't know that command yet.`
    );
  };

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
    rayaRecognitionRef.current = recognition;
  
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
  
    recognition.onstart = () => {
      setRayaListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
    
      setRayaTranscript(transcript);
    
      // Send what RAYA heard to the CRM command processor
      handleRayaCommand(transcript);
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

  const stopRayaListening = () => {
    const recognition = rayaRecognitionRef.current;
  
    if (!recognition) return;
  
    try {
      recognition.stop();
    } catch (error) {
      // Recognition has already stopped.
    }
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
                  onClick={() => {
                    if (rayaEnabled) {
                      toggleRaya();
                    } else {
                      setRayaOpen(true);
                    }
                  }}
                  className={`h-9 px-3 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-colors ${
                    rayaEnabled
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-stone-200 bg-white hover:bg-stone-50 text-[#1B365D]"
                  }`}
                  title={rayaEnabled ? "Turn RAYA off" : "Turn RAYA on"}
                >
                  <span className="text-xl leading-none">🎙️</span>
                  RAYA
                  <span
                    className={`w-2 h-2 rounded-full ${
                      rayaEnabled ? "bg-green-500" : "bg-stone-300"
                    }`}
                  />
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
                    onClick={() => {
                      if (!rayaEnabled) {
                        toggleRaya();
                      }
                  
                      setRayaOpen(false);
                    }}
                    className="mt-5 w-full h-11 rounded-xl bg-[#1B365D] hover:bg-[#152a4a] text-white text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <span className="text-xl leading-none">🎙️</span>
                    Turn RAYA On
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

              {/* RAYA Persistent Voice Button */}
              {rayaEnabled && !rayaOpen && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60]">
                  <div
                    onMouseDown={startRayaListening}
                    onMouseUp={stopRayaListening}
                    onMouseLeave={() => {
                      if (rayaListening) {
                        stopRayaListening();
                      }
                    }}
                    className={`w-12 h-12 rounded-full flex items-center justify-center cursor-pointer select-none shadow-lg transition-all duration-150 ${
                      rayaListening
                        ? "bg-[#2563EB] scale-105"
                        : "bg-[#2F6FD6] hover:bg-[#2A64C8]"
                    }`}
                    title="RAYA"
                  >
                    <div className="flex items-center gap-[3px]">
                      <span
                        className={`w-[3px] rounded-full bg-white transition-all ${
                          rayaListening ? "h-5" : "h-3"
                        }`}
                      />
                      <span
                        className={`w-[3px] rounded-full bg-white transition-all ${
                          rayaListening ? "h-7" : "h-5"
                        }`}
                      />
                      <span
                        className={`w-[3px] rounded-full bg-white transition-all ${
                          rayaListening ? "h-4" : "h-7"
                        }`}
                      />
                      <span
                        className={`w-[3px] rounded-full bg-white transition-all ${
                          rayaListening ? "h-7" : "h-5"
                        }`}
                      />
                      <span
                        className={`w-[3px] rounded-full bg-white transition-all ${
                          rayaListening ? "h-5" : "h-3"
                        }`}
                      />
                    </div>
                  </div>
                </div>
              )}
        
        <Toaster position="top-right" richColors />
      </main>
    </div>
  );
}
