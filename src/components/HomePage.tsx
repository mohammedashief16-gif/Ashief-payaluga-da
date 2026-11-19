import {
  AlertTriangle,
  Bot,
  Droplets,
  HeartHandshake,
  PhoneCall,
  Search,
  UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import type { PlatformStats } from "../types";

export function HomePage() {
  const { t, navigate, apiFetch } = useApp();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [storyImgFailed, setStoryImgFailed] = useState(false);

  useEffect(() => {
    apiFetch<PlatformStats>("/api/stats")
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-20">
      {/* Hero Section */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <p className="text-xs font-semibold tracking-wide text-red-700">
                {t("heroEyebrow")}
              </p>

              <h1
                className="font-display font-extrabold tracking-tight text-slate-950 leading-[1.12]"
                style={{
                  fontSize: "clamp(2.25rem, 4vw, 3.5rem)",
                  textWrap: "balance",
                }}
              >
                {t("heroTitle")}
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                {t("heroSubtitle")}
              </p>

              {/* Primary + Key Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigate("find")}
                  className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Search className="w-4 h-4" aria-hidden="true" />
                  {t("ctaFindBlood")}
                </button>

                <button
                  type="button"
                  onClick={() => navigate("register-donor")}
                  className="inline-flex items-center gap-2 px-5 py-3.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" aria-hidden="true" />
                  {t("ctaBecomeDonor")}
                </button>

                <button
                  type="button"
                  onClick={() => navigate("request-blood")}
                  className="inline-flex items-center gap-2 px-5 py-3.5 text-sm font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <HeartHandshake className="w-4 h-4 text-red-600" aria-hidden="true" />
                  {t("ctaRequestBlood")}
                </button>

                <button
                  type="button"
                  onClick={() => navigate("ai")}
                  className="inline-flex items-center gap-2 px-5 py-3.5 text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Bot className="w-4 h-4 text-slate-900" aria-hidden="true" />
                  {t("ctaAiAssistant")}
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[280px] lg:min-h-[400px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 relative">
                {!heroImgFailed ? (
                  <img
                    src="/src/assets/images/hero_blood_center_1795062993175.jpg"
                    alt="Modern hospital blood donation clinic with medical staff"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-slate-900 text-white text-center space-y-3">
                    <Droplets className="w-10 h-10 text-red-500" />
                    <p className="font-display text-xl font-bold">BloodConnect</p>
                    <p className="text-sm text-slate-300">{t("brandTagline")}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4-Column Live KPI Strip */}
          <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-4 pt-10 border-t border-slate-200">
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs font-medium text-slate-500">{t("statTotalDonors")}</p>
              <p className="font-display text-3xl font-extrabold text-slate-950 mt-2 tabular-nums">
                {stats ? stats.totalDonors : "—"}
              </p>
            </div>
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs font-medium text-slate-500">{t("statAvailableNow")}</p>
              <p className="font-display text-3xl font-extrabold text-emerald-700 mt-2 tabular-nums">
                {stats ? stats.availableDonors : "—"}
              </p>
            </div>
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs font-medium text-slate-500">{t("statTotalRequests")}</p>
              <p className="font-display text-3xl font-extrabold text-slate-950 mt-2 tabular-nums">
                {stats ? stats.totalRequests : "—"}
              </p>
            </div>
            <div className="p-5 rounded-xl bg-red-50/70 border border-red-200">
              <p className="text-xs font-medium text-red-800">{t("statEmergencyRequests")}</p>
              <p className="font-display text-3xl font-extrabold text-red-700 mt-2 tabular-nums">
                {stats ? stats.emergencyRequests : "—"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Available Donors by Blood Group */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              {t("bloodGroupSectionTitle")}
            </h2>
            <p className="text-sm text-slate-600 mt-1.5">{t("bloodGroupSectionSub")}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("find", { bloodGroup: "ALL", city: "", area: "" })}
            className="text-sm font-semibold text-red-700 hover:text-red-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t("ctaFindBlood")} →
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3.5">
          {(stats?.bloodGroupCounts ?? [
            "O+",
            "O-",
            "A+",
            "A-",
            "B+",
            "B-",
            "AB+",
            "AB-",
          ].map((bg) => ({ bloodGroup: bg, available: 0, total: 0 }))).map((item) => (
            <button
              key={item.bloodGroup}
              type="button"
              onClick={() =>
                navigate("find", { bloodGroup: item.bloodGroup, city: "", area: "" })
              }
              className="group text-left p-4 rounded-xl bg-white border border-slate-200 hover:border-red-500 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-xl font-extrabold text-red-700 tabular-nums">
                  {item.bloodGroup}
                </span>
                <Droplets
                  className="w-4 h-4 text-slate-300 group-hover:text-red-500 transition-colors"
                  aria-hidden="true"
                />
              </div>
              <p className="mt-3 text-lg font-bold text-slate-900 tabular-nums">
                {item.available}{" "}
                <span className="text-xs font-normal text-slate-500">
                  {t("availableUnitWord")}
                </span>
              </p>
              <p className="text-xs text-slate-400 tabular-nums mt-0.5">
                {item.total} {t("registeredUnitWord")}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* How It Works + Community Photography */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-7 space-y-6">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
                {t("howItWorksTitle")}
              </h2>
              <p className="text-sm text-slate-600 mt-1.5">{t("howItWorksSub")}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { title: t("step1Title"), desc: t("step1Desc") },
                { title: t("step2Title"), desc: t("step2Desc") },
                { title: t("step3Title"), desc: t("step3Desc") },
                { title: t("step4Title"), desc: t("step4Desc") },
              ].map((step) => (
                <div
                  key={step.title}
                  className="p-5 rounded-xl bg-white border border-slate-200 space-y-2"
                >
                  <h3 className="font-display text-base font-bold text-slate-900">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col justify-between bg-slate-900 text-white rounded-2xl overflow-hidden border border-slate-800">
            <div className="aspect-4/3 w-full bg-slate-800 overflow-hidden">
              {!storyImgFailed ? (
                <img
                  src="/src/assets/images/donor_community_story_1795062993792.jpg"
                  alt="Community blood drive clinic volunteers and nurses"
                  referrerPolicy="no-referrer"
                  onError={() => setStoryImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-8 text-slate-300">
                  <HeartHandshake className="w-12 h-12 text-red-500" />
                </div>
              )}
            </div>
            <div className="p-6 space-y-3">
              <h3 className="font-display text-xl font-bold text-white">
                {t("communityTitle")}
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                {t("communityBody")}
              </p>
              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate("register-donor")}
                  className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer"
                >
                  {t("ctaBecomeDonor")}
                </button>
                <button
                  type="button"
                  onClick={() => navigate("ai")}
                  className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors cursor-pointer"
                >
                  {t("ctaAiAssistant")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Emergency Information & Safety Notice */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-red-50/70 border border-red-200 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
              <h2 className="font-display text-lg font-bold">{t("emergencyTitle")}</h2>
            </div>
            <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-red-700 shrink-0" aria-hidden="true" />
              <span>{t("emergencyHelpline")}</span>
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">
              {t("emergencyDisclaimer")}
            </p>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => navigate("request-blood")}
              className="px-5 py-3 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              {t("ctaRequestBlood")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
