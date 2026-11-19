import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import type { AuthUser, UserRole } from "../types";

export function AuthPage() {
  const { t, setSession, navigate, apiFetch, notify } = useApp();
  const [mode, setMode] = useState<"login" | "register">("login");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("donor");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "login") {
        const res = await apiFetch<{ token: string; user: AuthUser }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        setSession(res.token, res.user);
        notify(`Welcome back, ${res.user.fullName}`, "success");
        navigate("dashboard");
      } else {
        const res = await apiFetch<{ token: string; user: AuthUser }>(
          "/api/auth/register",
          {
            method: "POST",
            body: JSON.stringify({
              fullName,
              email,
              password,
              role,
              phone,
              city,
              area,
            }),
          }
        );
        setSession(res.token, res.user);
        notify(`Account created for ${res.user.fullName}`, "success");
        navigate(role === "donor" ? "register-donor" : "dashboard");
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : "Authentication failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const quickFillDemo = (demoEmail: string, demoPassword: string) => {
    setMode("login");
    setEmail(demoEmail);
    setPassword(demoPassword);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              mode === "login"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t("btnSignIn")}
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              mode === "register"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t("btnCreateAccount")}
          </button>
        </div>

        <h1 className="font-display text-2xl font-bold text-slate-950">
          {mode === "login" ? t("authTitleSignIn") : t("authTitleRegister")}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t("authRoleLabel")}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole("donor")}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border cursor-pointer ${
                      role === "donor"
                        ? "border-red-600 bg-red-50 text-red-700"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    {t("roleDonor")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("requester")}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border cursor-pointer ${
                      role === "requester"
                        ? "border-red-600 bg-red-50 text-red-700"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    {t("roleRequester")}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t("labelFullName")} *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t("labelPhone")}
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t("labelCity")}
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t("labelArea")}
                </label>
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t("labelEmail")} *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t("labelPassword")} *
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
          >
            {mode === "login" ? t("btnSignIn") : t("btnCreateAccount")}
          </button>
        </form>
      </div>

      {/* Demo Accounts */}
      <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 space-y-2.5">
        <p className="text-xs font-semibold text-slate-700">{t("demoAccountsTitle")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => quickFillDemo("karthik@bloodconnect.org", "Donor@123")}
            className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg hover:border-slate-400 text-left cursor-pointer"
          >
            <span className="block font-semibold text-slate-900">Donor</span>
            <span className="text-slate-500 truncate block">karthik@...</span>
          </button>
          <button
            type="button"
            onClick={() => quickFillDemo("priya@bloodconnect.org", "Requester@123")}
            className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg hover:border-slate-400 text-left cursor-pointer"
          >
            <span className="block font-semibold text-slate-900">Requester</span>
            <span className="text-slate-500 truncate block">priya@...</span>
          </button>
          <button
            type="button"
            onClick={() => quickFillDemo("admin@bloodconnect.org", "Admin@123")}
            className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg hover:border-slate-400 text-left cursor-pointer"
          >
            <span className="block font-semibold text-slate-900">Admin</span>
            <span className="text-slate-500 truncate block">admin@...</span>
          </button>
        </div>
      </div>
    </div>
  );
}
