import { Droplets, Globe, Menu, X } from "lucide-react";
import { useState } from "react";
import { useApp } from "../context/AppContext";
import { LANGUAGE_OPTIONS } from "../i18n/translations";
import type { AppPage, LanguageCode } from "../types";

export function Navbar() {
  const { page, navigate, language, setLanguage, t, user, logout } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: Array<{ id: AppPage; label: string }> = [
    { id: "find", label: t("navFind") },
    { id: "request-blood", label: t("navRequest") },
    { id: "register-donor", label: t("navBecomeDonor") },
    { id: "ai", label: t("navAi") },
    ...(user ? [{ id: "dashboard" as AppPage, label: t("navDashboard") }] : []),
  ];

  const handleNav = (id: AppPage) => {
    navigate(id);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 md:gap-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNav("home")}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 rounded-md py-1"
        >
          <span className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0">
            <Droplets className="w-4 h-4" aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-slate-900">
            BloodConnect
          </span>
        </button>

        {/* Zone 2: Concise Single-Line Navigation Links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-600"
        >
          {navItems.map((item) => {
            const active = page === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                  active
                    ? "border-red-600 text-slate-950 font-semibold"
                    : "border-transparent hover:text-slate-950 hover:border-slate-300"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Language Selector + Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative flex items-center">
            <Globe
              className="w-4 h-4 text-slate-500 absolute left-2.5 pointer-events-none"
              aria-hidden="true"
            />
            <select
              aria-label="Language Selector"
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              className="pl-8 pr-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-600 cursor-pointer"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.native}
                </option>
              ))}
            </select>
          </div>

          {user ? (
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleNav("dashboard")}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {user.fullName.split(" ")[0]} · {t("navDashboard")}
              </button>
              <button
                type="button"
                onClick={logout}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-red-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t("navSignOut")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleNav("auth")}
              className="hidden sm:inline-flex px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t("navSignIn")}
            </button>
          )}

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((v) => !v)}
            className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item.id)}
              className={`block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${
                page === item.id
                  ? "bg-red-50 text-red-700 font-semibold"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
          <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => handleNav("dashboard")}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-lg"
                >
                  {t("navDashboard")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setMobileOpen(false);
                  }}
                  className="px-4 py-2.5 text-sm font-medium text-red-700 border border-red-200 rounded-lg"
                >
                  {t("navSignOut")}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleNav("auth")}
                className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-lg"
              >
                {t("navSignIn")}
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
