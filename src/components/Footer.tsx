import { Droplets, PhoneCall } from "lucide-react";
import { useApp } from "../context/AppContext";

export function Footer() {
  const { t, navigate } = useApp();

  return (
    <footer className="bg-slate-950 text-slate-300 border-t border-slate-900 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-slate-800">
          <div className="md:col-span-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-md bg-red-600 text-white flex items-center justify-center">
                <Droplets className="w-4 h-4" aria-hidden="true" />
              </span>
              <span className="font-display text-lg font-bold text-white">
                BloodConnect
              </span>
            </div>
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              {t("brandTagline")}
            </p>
            <div className="flex items-center gap-2 text-xs text-red-300 pt-1">
              <PhoneCall className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{t("emergencyHelpline")}</span>
            </div>
          </div>

          <div className="md:col-span-3 space-y-2 text-sm">
            <h3 className="font-display text-xs font-semibold text-white tracking-wide">
              Platform
            </h3>
            <ul className="space-y-1.5 text-slate-400">
              <li>
                <button
                  type="button"
                  onClick={() => navigate("find")}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {t("navFind")}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate("request-blood")}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {t("navRequest")}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate("register-donor")}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {t("navBecomeDonor")}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate("ai")}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {t("navAi")}
                </button>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-2">
            <h3 className="font-display text-xs font-semibold text-white tracking-wide">
              {t("emergencyTitle")}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {t("emergencyDisclaimer")}
            </p>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} BloodConnect. Community Blood Coordination Platform.</p>
          <p>Consent-protected donor directory · Hospital verification required</p>
        </div>
      </div>
    </footer>
  );
}
