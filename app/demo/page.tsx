"use client";

import React, { useState, useEffect, useRef } from "react";
import Vapi from "@vapi-ai/web";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Sparkles,
  Building2,
  BedDouble,
  DollarSign,
  Volume2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Radio,
  Sliders,
  MessageSquare,
  ShieldCheck,
  ExternalLink,
  Send,
  User,
  Smartphone,
  X,
  CreditCard,
} from "lucide-react";

interface TranscriptMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  time: string;
}

export default function DemoPage() {
  // Prospect Input State (defaulted to Grand Hotel Galle demo)
  const [businessName, setBusinessName] = useState("Grand Hotel Galle");
  const [featuredService, setFeaturedService] = useState("Deluxe Ocean Suite");
  const [nightlyRate, setNightlyRate] = useState("180");

  // Vapi Credentials State
  const [publicKey, setPublicKey] = useState(
    process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || ""
  );
  const [assistantId, setAssistantId] = useState(
    process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || ""
  );
  const demoPhoneNumber =
    process.env.NEXT_PUBLIC_DEMO_PHONE_NUMBER || "+17124815055";

  // Call & UI State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    type: "idle" | "success" | "error";
    message: string;
  }>({ type: "idle", message: "" });

  const [callStatus, setCallStatus] = useState<
    "idle" | "connecting" | "active" | "error"
  >("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Guest Contact Input State
  const [guestPhone, setGuestPhone] = useState("");
  const [guestName, setGuestName] = useState("");
  const [quickTextMessage, setQuickTextMessage] = useState("");
  const [isContactBoxOpen, setIsContactBoxOpen] = useState(false);
  const [contactSubmitted, setContactSubmitted] = useState(false);

  const vapiRef = useRef<any>(null);
  const transcriptsEndRef = useRef<HTMLDivElement>(null);

  // Send contact details directly to live voice agent
  const handleSendContactDetails = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const phone = guestPhone.trim();
    if (!phone) return;

    const messageContent = guestName.trim()
      ? `My name is ${guestName.trim()} and my contact phone number is ${phone}. Please send the booking deposit link to this number.`
      : `My contact phone number is ${phone}. Please send the booking deposit link to this number.`;

    if (vapiRef.current && callStatus === "active") {
      try {
        vapiRef.current.send({
          type: "add-message",
          message: {
            role: "user",
            content: messageContent,
          },
          triggerResponseEnabled: true,
        });
      } catch (err) {
        console.error("Failed to send contact to Vapi:", err);
      }
    }

    setTranscripts((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "user",
        text: `📱 Shared Contact: ${phone}${guestName ? ` (${guestName.trim()})` : ""}`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);

    setContactSubmitted(true);
    setTimeout(() => {
      setContactSubmitted(false);
      setIsContactBoxOpen(false);
    }, 2500);
  };

  // Send arbitrary chat / digit text to live agent
  const handleSendTextMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = quickTextMessage.trim();
    if (!text) return;

    if (vapiRef.current && callStatus === "active") {
      try {
        vapiRef.current.send({
          type: "add-message",
          message: {
            role: "user",
            content: text,
          },
          triggerResponseEnabled: true,
        });
      } catch (err) {
        console.error("Failed to send text to Vapi:", err);
      }
    }

    setTranscripts((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "user",
        text: text,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);

    setQuickTextMessage("");
  };

  // Auto-scroll transcript container
  useEffect(() => {
    transcriptsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  // Copy phone number helper
  const handleCopyPhone = () => {
    navigator.clipboard.writeText(demoPhoneNumber);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  // Sync Live Demo Agent via POST /api/demo/update-prompt
  const handleSyncPrompt = async () => {
    setIsSyncing(true);
    setSyncStatus({ type: "idle", message: "" });

    try {
      const res = await fetch("/api/demo/update-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          featuredService,
          nightlyRate,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to sync prompt");
      }

      if (data.liveSynced) {
        setSyncStatus({
          type: "success",
          message: `Synced live with Vapi! Assistant (${data.assistantId}) is active with ${businessName} specifications.`,
        });
      } else {
        setSyncStatus({
          type: "success",
          message: `Prompt compiled locally for ${businessName}! (Add VAPI_API_KEY to .env.local to update remote Vapi cloud account automatically).`,
        });
      }
    } catch (err: any) {
      console.error(err);
      setSyncStatus({
        type: "error",
        message: err.message || "Failed to update prompt.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Initialize and Start Web Call with @vapi-ai/web
  const handleStartCall = async () => {
    if (callStatus === "connecting" || callStatus === "active") return;

    const keyToUse =
      publicKey && !publicKey.includes("your-vapi-public-key")
        ? publicKey.trim()
        : null;

    if (!keyToUse) {
      alert(
        "Please provide your Vapi Public Key (either in .env.local as NEXT_PUBLIC_VAPI_PUBLIC_KEY or enter it in the credentials section)."
      );
      return;
    }

    try {
      setCallStatus("connecting");
      setTranscripts((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "system",
          text: `Connecting to ${businessName} voice concierge...`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        },
      ]);

      const vapi = new Vapi(keyToUse);
      vapiRef.current = vapi;

      vapi.on("call-start", () => {
        setCallStatus("active");
        setTranscripts((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "system",
            text: "Call connected. Sarah (Voice Concierge) is listening.",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      });

      vapi.on("call-end", () => {
        setCallStatus("idle");
        setIsSpeaking(false);
        setTranscripts((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "system",
            text: "Call terminated.",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      });

      vapi.on("speech-start", () => {
        setIsSpeaking(true);
      });

      vapi.on("speech-end", () => {
        setIsSpeaking(false);
      });

      vapi.on("volume-level", (level: number) => {
        setVolumeLevel(level);
      });

      vapi.on("message", (message: any) => {
        // 1. Handle modern Vapi tool-calls over WebRTC
        if (message.type === "tool-calls" && Array.isArray(message.toolCalls)) {
          console.log("[CLIENT TOOL CALL RECEIVED]:", message.toolCalls);
          for (const tc of message.toolCalls) {
            const fnName = tc.function?.name;
            if (fnName === "get_service_availability_and_price") {
              const resText = `Live verification confirmed: The ${featuredService} is available for your requested dates at the exclusive rate of $${nightlyRate} per night. Included amenities are panoramic ocean view, complimentary artisanal breakfast buffet, and priority concierge access.`;
              try {
                vapi.send({
                  type: "add-message",
                  message: {
                    role: "tool",
                    tool_call_id: tc.id,
                    content: resText,
                  },
                  triggerResponseEnabled: true,
                });
                setTranscripts((prev) => [
                  ...prev,
                  {
                    id: Date.now().toString(),
                    role: "system",
                    text: `🛠️ Live Tool Executed: get_service_availability_and_price -> ${featuredService} @ $${nightlyRate}/night confirmed`,
                    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
                  },
                ]);
              } catch (err) {
                console.error("Failed to send client tool return message:", err);
              }
            }
          }
        }

        // 2. Handle legacy Vapi function-call over WebRTC
        if (message.type === "function-call") {
          const fnName = message.functionCall?.name;
          if (fnName === "get_service_availability_and_price") {
            const resText = `Live verification confirmed: The ${featuredService} is available for your requested dates at $${nightlyRate} per night.`;
            try {
              vapi.send({
                type: "add-message",
                message: {
                  role: "tool",
                  content: resText,
                },
                triggerResponseEnabled: true,
              });
              setTranscripts((prev) => [
                ...prev,
                {
                  id: Date.now().toString(),
                  role: "system",
                  text: `🛠️ Live Tool Executed: ${featuredService} @ $${nightlyRate}/night confirmed`,
                  time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
                },
              ]);
            } catch (err) {
              console.error("Failed to send function-call return message:", err);
            }
          }
        }

        if (message.type === "transcript") {
          const role = message.role === "user" ? "user" : "assistant";
          const text = message.transcript;

          if (message.transcriptType === "final" && text) {
            setTranscripts((prev) => [
              ...prev,
              {
                id: Date.now().toString(),
                role,
                text,
                time: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              },
            ]);
          }
        }
      });

      vapi.on("error", (e: any) => {
        console.error("Vapi Call Error:", e);
        setCallStatus("error");
        setTranscripts((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "system",
            text: `Call error: ${e.message || JSON.stringify(e)}`,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      });

      // Start call with configured Assistant ID or inline assistant config
      const aid =
        assistantId && !assistantId.includes("your-vapi-assistant-id")
          ? assistantId.trim()
          : null;

      if (aid) {
        await vapi.start(aid);
      } else {
        // Fallback: Start with assistant payload directly
        await vapi.start({
          transcriber: {
            provider: "deepgram",
            model: "nova-3",
            language: "en",
          },
          model: {
            provider: "openai",
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are Sarah, an ultra-poised, warm, and highly persuasive VIP Sales & Guest Experience Representative for ${businessName}. Your featured room is the ${featuredService} priced at $${nightlyRate}/night. Answer questions concisely and naturally.`,
              },
            ],
          },
          voice: {
            provider: "11labs",
            voiceId: "21m00Tcm4TlvDq8ikWAM",
            model: "eleven_turbo_v2_5",
          },
          firstMessage: `Hello! Thank you for calling ${businessName}. This is Sarah, your luxury concierge and reservations specialist. How may I assist you with your stay today?`,
        });
      }
    } catch (err: any) {
      console.error(err);
      setCallStatus("error");
      alert(`Could not start web call: ${err.message}`);
    }
  };

  const handleEndCall = () => {
    if (vapiRef.current) {
      vapiRef.current.stop();
      vapiRef.current = null;
    }
    setCallStatus("idle");
    setIsSpeaking(false);
  };

  const toggleMute = () => {
    if (vapiRef.current) {
      const nextMuted = !isMuted;
      vapiRef.current.setMuted(nextMuted);
      setIsMuted(nextMuted);
    }
  };

  const isConfigured =
    publicKey &&
    !publicKey.includes("your-vapi-public-key") &&
    assistantId &&
    !assistantId.includes("your-vapi-assistant-id");

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Top Header / Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-sky-400 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Founder 2
                </h1>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Field Sales Portal
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Autonomous Hospitality Voice AI Demo Platform
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-2" />
              <span className="text-slate-300 font-medium">
                Deepgram Nova-3 &bull; GPT-4o-mini &bull; ElevenLabs v2.5
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-6 pt-8">
        {/* Credentials Banner / Notice */}
        {!isConfigured && (
          <div className="mb-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <h4 className="font-semibold text-amber-200">
                Credentials Setup Reminder
              </h4>
              <p className="text-amber-300/80 mt-0.5">
                Ensure your credentials are added to{" "}
                <code className="bg-amber-950/80 px-1.5 py-0.5 rounded text-amber-200 font-mono text-xs">
                  .env.local
                </code>{" "}
                (VAPI_API_KEY, NEXT_PUBLIC_VAPI_PUBLIC_KEY,
                NEXT_PUBLIC_VAPI_ASSISTANT_ID). You can also paste your Public
                Key below for instant browser calls.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Prospect Customizer & Inbound Telephony */}
          <div className="lg:col-span-5 space-y-6">
            {/* Prospect Configuration Card */}
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-5 w-5 text-blue-400" />
                  <h3 className="font-semibold text-white">
                    Prospect Customizer
                  </h3>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Live Injection
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Business Name
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Grand Hotel Galle"
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Featured Service / Room
                  </label>
                  <div className="relative">
                    <BedDouble className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      value={featuredService}
                      onChange={(e) => setFeaturedService(e.target.value)}
                      placeholder="e.g. Deluxe Ocean Suite"
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Nightly Rate (USD)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      value={nightlyRate}
                      onChange={(e) => setNightlyRate(e.target.value)}
                      placeholder="e.g. 180"
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSyncPrompt}
                  disabled={isSyncing}
                  className="w-full mt-2 flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium py-3 px-4 rounded-xl shadow-lg shadow-blue-600/20 active:scale-[0.99] transition-all disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`}
                  />
                  <span>
                    {isSyncing ? "Syncing Agent..." : "Sync Live Demo Agent"}
                  </span>
                </button>

                {syncStatus.message && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                      syncStatus.type === "success"
                        ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                        : "bg-rose-500/10 border border-rose-500/30 text-rose-300"
                    }`}
                  >
                    {syncStatus.type === "success" ? (
                      <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    )}
                    <span>{syncStatus.message}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Inbound Telephony Card */}
            <div className="rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900/90 to-slate-900 border border-indigo-900/50 p-6 shadow-xl relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                    <Radio className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">
                      Inbound Cellular Line
                    </h3>
                    <p className="text-xs text-slate-400">
                      Direct Cellular PSTN Trunk
                    </p>
                  </div>
                </div>
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between mb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                    Assigned Telephone Number
                  </span>
                  <span className="text-xl font-mono font-bold text-indigo-300">
                    {demoPhoneNumber}
                  </span>
                </div>
                <button
                  onClick={handleCopyPhone}
                  className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  title="Copy Phone Number"
                >
                  {copiedPhone ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>

              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                  <span>Call from your cell phone, Skype, or Viber Out</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                  <span>
                    Auto-routes to the live AI Concierge for {businessName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                  <span>
                    Ask: &quot;Is the {featuredService} available next
                    weekend?&quot;
                  </span>
                </div>
              </div>
            </div>

            {/* Vapi Keys Quick-Config (Collapsible) */}
            <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Sliders className="h-4 w-4 text-slate-400" />
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    API Credentials Override
                  </h4>
                </div>
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">
                    NEXT_PUBLIC_VAPI_PUBLIC_KEY
                  </label>
                  <input
                    type="password"
                    value={publicKey}
                    onChange={(e) => setPublicKey(e.target.value)}
                    placeholder="Enter Vapi Public Key"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">
                    NEXT_PUBLIC_VAPI_ASSISTANT_ID
                  </label>
                  <input
                    type="text"
                    value={assistantId}
                    onChange={(e) => setAssistantId(e.target.value)}
                    placeholder="Enter Vapi Assistant ID"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Web Call Console & Real-Time Transcript */}
          <div className="lg:col-span-7 flex flex-col space-y-6">
            {/* Live Web Call Console */}
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl relative">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <Phone className="h-4 w-4 text-emerald-400" />
                    Web Call Console
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Direct browser-to-agent WebRTC voice bridge
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full ${
                      callStatus === "active"
                        ? "bg-emerald-500 animate-pulse"
                        : callStatus === "connecting"
                        ? "bg-amber-500 animate-ping"
                        : "bg-slate-600"
                    }`}
                  />
                  <span className="text-xs capitalize font-medium text-slate-300">
                    {callStatus}
                  </span>
                </div>
              </div>

              {/* Visualizer & Avatar Area */}
              <div className="flex flex-col items-center justify-center py-8 bg-slate-950/60 rounded-xl border border-slate-800/80 relative overflow-hidden">
                <div
                  className={`relative flex items-center justify-center rounded-full transition-all duration-300 ${
                    callStatus === "active"
                      ? isSpeaking
                        ? "w-28 h-28 bg-blue-600/30 border-2 border-blue-400 animate-pulse-glow"
                        : "w-24 h-24 bg-indigo-600/20 border border-indigo-500/50"
                      : "w-20 h-20 bg-slate-800/50 border border-slate-700"
                  }`}
                >
                  {callStatus === "active" ? (
                    <Volume2
                      className={`h-10 w-10 text-blue-300 ${
                        isSpeaking ? "animate-bounce" : ""
                      }`}
                    />
                  ) : (
                    <Phone className="h-8 w-8 text-slate-500" />
                  )}
                </div>

                <div className="mt-4 text-center">
                  <h4 className="text-sm font-semibold text-white">
                    Sarah &bull; {businessName}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    {callStatus === "active"
                      ? isSpeaking
                        ? "Agent is speaking..."
                        : "Listening to your voice..."
                      : callStatus === "connecting"
                      ? "Establishing WebRTC voice session..."
                      : "Ready to initiate live demo call"}
                  </p>
                </div>

                {/* Call Control Action Buttons */}
                <div className="mt-6 flex items-center space-x-3">
                  {callStatus === "idle" || callStatus === "error" ? (
                    <button
                      onClick={handleStartCall}
                      className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 px-6 rounded-full shadow-lg shadow-emerald-600/30 active:scale-95 transition-all"
                    >
                      <PhoneCall className="h-4 w-4" />
                      <span>Start Web Call</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={toggleMute}
                        className={`p-3 rounded-full border transition-all ${
                          isMuted
                            ? "bg-amber-600/20 border-amber-500/50 text-amber-400"
                            : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                        }`}
                        title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                      >
                        {isMuted ? (
                          <MicOff className="h-5 w-5" />
                        ) : (
                          <Mic className="h-5 w-5" />
                        )}
                      </button>

                      <button
                        onClick={handleEndCall}
                        className="flex items-center space-x-2 bg-rose-600 hover:bg-rose-500 text-white font-medium py-3 px-6 rounded-full shadow-lg shadow-rose-600/30 active:scale-95 transition-all"
                      >
                        <PhoneOff className="h-4 w-4" />
                        <span>End Call</span>
                      </button>
                    </>
                  )}
                </div>

                {/* Contact Details Toggle Button & Interactive Box */}
                <div className="mt-5 w-full max-w-md">
                  <button
                    onClick={() => setIsContactBoxOpen(!isContactBoxOpen)}
                    className="w-full flex items-center justify-center space-x-2 py-2 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-xs font-medium text-slate-200 transition-colors"
                  >
                    <Smartphone className="h-4 w-4 text-emerald-400" />
                    <span>{isContactBoxOpen ? "Hide Contact Input" : "Input Contact Details / Phone Number"}</span>
                  </button>

                  {isContactBoxOpen && (
                    <form
                      onSubmit={handleSendContactDetails}
                      className="mt-3 p-4 rounded-xl bg-slate-900 border border-blue-500/40 shadow-lg space-y-3 animate-in fade-in duration-200"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <Smartphone className="h-3.5 w-3.5 text-blue-400" />
                          Share Guest Phone & Details
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsContactBoxOpen(false)}
                          className="text-slate-400 hover:text-white"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">Guest Name (Optional)</label>
                          <input
                            type="text"
                            value={guestName}
                            onChange={(e) => setGuestName(e.target.value)}
                            placeholder="e.g. John Doe"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">Mobile / WhatsApp Number</label>
                          <input
                            type="tel"
                            value={guestPhone}
                            onChange={(e) => setGuestPhone(e.target.value)}
                            placeholder="e.g. 0740779470"
                            required
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-md shadow-blue-600/20 transition-all active:scale-[0.99]"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>Send Details to Sarah</span>
                      </button>

                      {contactSubmitted && (
                        <div className="text-[11px] text-emerald-400 flex items-center justify-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 py-1.5 rounded-lg">
                          <Check className="h-3.5 w-3.5" />
                          <span>Contact details delivered to Sarah & saved for WhatsApp!</span>
                        </div>
                      )}
                    </form>
                  )}
                </div>
              </div>
            </div>

            {/* Real-Time Transcript Log Card */}
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl flex-1 flex flex-col min-h-[340px]">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4 text-blue-400" />
                  <h3 className="font-semibold text-white">Live Transcript</h3>
                </div>
                <span className="text-xs text-slate-500 font-mono">
                  {transcripts.length} event
                  {transcripts.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2 max-h-[380px]">
                {transcripts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs py-12">
                    <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
                    <p>No conversation events yet.</p>
                    <p className="mt-1">
                      Click &quot;Start Web Call&quot; or dial{" "}
                      {demoPhoneNumber} to talk.
                    </p>
                  </div>
                ) : (
                  transcripts.map((item) => (
                    <div
                      key={item.id}
                      className={`flex flex-col ${
                        item.role === "user"
                          ? "items-end"
                          : item.role === "assistant"
                          ? "items-start"
                          : "items-center"
                      }`}
                    >
                      {item.role === "system" ? (
                        <div className="text-[11px] text-slate-500 italic bg-slate-950/60 px-3 py-1 rounded-full border border-slate-800 my-1">
                          {item.text} &bull; {item.time}
                        </div>
                      ) : (
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-md ${
                            item.role === "user"
                              ? "bg-blue-600 text-white rounded-br-none"
                              : "bg-slate-800 text-slate-200 border border-slate-700/80 rounded-bl-none"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4 mb-1 text-[10px] opacity-75">
                            <span className="font-bold uppercase tracking-wider">
                              {item.role === "user" ? "You" : "Sarah (Concierge)"}
                            </span>
                            <span>{item.time}</span>
                          </div>
                          <p className="leading-relaxed">{item.text}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={transcriptsEndRef} />
              </div>

              {/* Direct Quick Chat / Phone Input for Live Call */}
              <form onSubmit={handleSendTextMessage} className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2">
                <input
                  type="text"
                  value={quickTextMessage}
                  onChange={(e) => setQuickTextMessage(e.target.value)}
                  placeholder={
                    callStatus === "active"
                      ? "Type phone number or message to Sarah (e.g. 0740779470)..."
                      : "Type message or phone number..."
                  }
                  className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!quickTextMessage.trim()}
                  className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium py-2 px-3.5 rounded-xl transition-all active:scale-95 shadow-md shadow-blue-600/20"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

