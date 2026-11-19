import { AlertTriangle, ArrowRight, Bot, Send, User } from "lucide-react";
import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import type { AppPage, SearchFilters } from "../types";

interface ChatMessage {
  id: number;
  role: "user" | "model";
  text: string;
  detectedLanguage?: string;
  suggestedNavigation?: {
    page: AppPage;
    label: string;
    filters?: Partial<SearchFilters>;
  };
  matchingDonorsPreview?: Array<{
    id: number;
    fullName: string;
    bloodGroup: string;
    city: string;
    area: string;
    availability: string;
    verified: boolean;
  }>;
  requestsPreview?: Array<{
    id: number;
    trackingCode: string;
    patientName: string;
    bloodGroup: string;
    hospitalName: string;
    city: string;
    status: string;
    urgency: string;
  }>;
}

export function AiAssistantPage() {
  const { t, language, apiFetch, navigate } = useApp();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "model",
      text: "Vanakkam / Namaste / Hello! I am BloodConnect AI. Ask me in English, Tanglish, Tamil, or Hindi to find donors, check a blood request status, or guide you through donor registration.",
    },
  ]);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now(),
      role: "user",
      text: trimmed,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);

    try {
      const res = await apiFetch<{
        reply: string;
        detectedLanguage: string;
        suggestedNavigation?: ChatMessage["suggestedNavigation"];
        matchingDonorsPreview?: ChatMessage["matchingDonorsPreview"];
        requestsPreview?: ChatMessage["requestsPreview"];
      }>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          message: trimmed,
          uiLanguage: language,
          history: nextHistory.map((m) => ({ role: m.role, text: m.text })),
        }),
      });

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "model",
          text: res.reply,
          detectedLanguage: res.detectedLanguage,
          suggestedNavigation: res.suggestedNavigation,
          matchingDonorsPreview: res.matchingDonorsPreview,
          requestsPreview: res.requestsPreview,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "model",
          text:
            err instanceof Error
              ? err.message
              : "Sorry, BloodConnect AI encountered an error. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const samplePrompts = [
    t("aiPrompt1"),
    t("aiPrompt2"),
    t("aiPrompt3"),
    t("aiPrompt4"),
    t("aiPrompt5"),
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950">
            {t("aiTitle")}
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1">{t("aiSub")}</p>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="rounded-xl bg-red-50/70 border border-red-200 px-4 py-3 flex items-start gap-2.5 text-xs text-red-900">
        <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
        <span>{t("aiSafetyNote")}</span>
      </div>

      {/* Quick Prompts */}
      <div className="flex flex-wrap gap-2">
        {samplePrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={loading}
            onClick={() => sendMessage(prompt)}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Container */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col min-h-[460px] max-h-[640px]">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${
                msg.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  msg.role === "user"
                    ? "bg-slate-900 text-white"
                    : "bg-red-600 text-white"
                }`}
              >
                {msg.role === "user" ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed space-y-3 ${
                  msg.role === "user"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-50 border border-slate-200 text-slate-800"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>

                {/* Live Database Matching Donors Preview */}
                {msg.matchingDonorsPreview && msg.matchingDonorsPreview.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 space-y-1.5">
                    <p className="text-xs font-semibold text-slate-500">
                      Live Matching Donors
                    </p>
                    {msg.matchingDonorsPreview.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 text-xs"
                      >
                        <span className="font-semibold text-slate-900">
                          {d.fullName} · {d.area}, {d.city}
                        </span>
                        <span className="font-display font-bold text-red-700">
                          {d.bloodGroup}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Live Request Status Preview */}
                {msg.requestsPreview && msg.requestsPreview.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 space-y-1.5">
                    <p className="text-xs font-semibold text-slate-500">
                      Request Status Records
                    </p>
                    {msg.requestsPreview.map((r) => (
                      <div
                        key={r.id}
                        className="bg-white px-3 py-2 rounded-lg border border-slate-200 text-xs flex items-center justify-between gap-2"
                      >
                        <div>
                          <span className="font-mono font-bold text-slate-900">
                            {r.trackingCode}
                          </span>{" "}
                          · {r.hospitalName} ({r.bloodGroup})
                        </div>
                        <span className="font-semibold capitalize text-slate-700">
                          {r.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Direct Action Navigation */}
                {msg.suggestedNavigation && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          msg.suggestedNavigation!.page,
                          msg.suggestedNavigation!.filters
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer"
                    >
                      <span>{msg.suggestedNavigation.label}</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500 pl-11">
              <span>{t("aiThinking")}</span>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t border-slate-200 p-3 sm:p-4 bg-white flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("aiPlaceholder")}
            className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer min-h-[42px]"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            <span>{t("aiSend")}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
