import { CheckCircle2, ShieldCheck } from "lucide-react";
import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import type { AuthUser } from "../types";

const BLOOD_GROUPS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

export function DonorRegisterPage() {
  const { t, user, setSession, apiFetch, notify, navigate } = useApp();

  const [fullName, setFullName] = useState(user?.fullName || "");
  const [age, setAge] = useState("25");
  const [bloodGroup, setBloodGroup] = useState("O+");
  const [phone, setPhone] = useState(user?.phone || "");
  const [city, setCity] = useState(user?.city || "");
  const [area, setArea] = useState(user?.area || "");
  const [availability, setAvailability] = useState("available");
  const [lastDonationDate, setLastDonationDate] = useState("");
  const [consentShareContact, setConsentShareContact] = useState(true);
  const [consentWhatsapp, setConsentWhatsapp] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAge = Number(age);
    if (!fullName.trim() || !phone.trim() || !city.trim() || !area.trim()) {
      notify(t("errRequiredFields"), "error");
      return;
    }
    if (!Number.isFinite(numericAge) || numericAge < 18 || numericAge > 65) {
      notify(t("errInvalidAge"), "error");
      return;
    }
    if (phone.replace(/[^0-9]/g, "").length < 8) {
      notify(t("errInvalidPhone"), "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<{
        token?: string | null;
        user?: AuthUser | null;
        message: string;
      }>("/api/donors/register", {
        method: "POST",
        body: JSON.stringify({
          fullName,
          age: numericAge,
          bloodGroup,
          phone,
          city,
          area,
          availability,
          lastDonationDate,
          consentShareContact,
          consentWhatsapp,
          email: !user && email.trim() ? email.trim() : undefined,
          password: !user && password ? password : undefined,
        }),
      });

      if (res.token && res.user) {
        setSession(res.token, res.user);
      }

      setSavedSuccess(true);
      notify(t("donorRegSuccess"), "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Registration failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (savedSuccess) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-5">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-950">
            {t("donorRegSuccess")}
          </h1>
          <p className="text-sm text-slate-600">
            {fullName} · {bloodGroup} · {area}, {city}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {user && (
              <button
                type="button"
                onClick={() => navigate("dashboard")}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                {t("navDashboard")}
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate("find")}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
            >
              {t("navFind")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950">
          {t("donorRegTitle")}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 mt-1.5">{t("donorRegSub")}</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t("labelAge")} *
            </label>
            <input
              type="number"
              min={18}
              max={65}
              required
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t("labelBloodGroup")} *
            </label>
            <select
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t("labelPhone")} *
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98400 00000"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t("labelAvailability")}
            </label>
            <select
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              <option value="available">{t("statusAvailable")}</option>
              <option value="unavailable">{t("statusUnavailable")}</option>
              <option value="recently_donated">{t("statusRecentlyDonated")}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t("labelCity")} *
            </label>
            <input
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t("placeholderCity")}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t("labelArea")} *
            </label>
            <input
              type="text"
              required
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder={t("placeholderArea")}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t("labelLastDonation")}
            </label>
            <input
              type="date"
              value={lastDonationDate}
              onChange={(e) => setLastDonationDate(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>
        </div>

        {/* Consent & Privacy */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
            <ShieldCheck className="w-4 h-4 text-red-600" aria-hidden="true" />
            <span>Contact Privacy & Consent</span>
          </div>

          <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={consentShareContact}
              onChange={(e) => {
                setConsentShareContact(e.target.checked);
                if (!e.target.checked) setConsentWhatsapp(false);
              }}
              className="mt-1 rounded border-slate-300 text-red-600 focus:ring-red-600"
            />
            <span>{t("labelConsentShare")}</span>
          </label>

          <label
            className={`flex items-start gap-2.5 text-sm cursor-pointer ${
              consentShareContact ? "text-slate-700" : "text-slate-400"
            }`}
          >
            <input
              type="checkbox"
              disabled={!consentShareContact}
              checked={consentWhatsapp}
              onChange={(e) => setConsentWhatsapp(e.target.checked)}
              className="mt-1 rounded border-slate-300 text-red-600 focus:ring-red-600"
            />
            <span>{t("labelConsentWhatsapp")}</span>
          </label>
        </div>

        {/* Optional Login Credentials if not logged in */}
        {!user && (
          <div className="pt-4 border-t border-slate-200 space-y-4">
            <p className="text-xs font-semibold text-slate-700">
              {t("labelAccountOptional")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {t("labelEmail")}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {t("labelPassword")}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
        >
          {t("btnSaveDonor")}
        </button>
      </form>
    </div>
  );
}
