import { CheckCircle2, Flag, MapPin, MessageCircle, Phone, ShieldAlert, X } from "lucide-react";
import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import type { PublicDonor } from "../types";
import { ReportModal } from "./ReportModal";

export function DonorCard({ donor }: { donor: PublicDonor }) {
  const { t, apiFetch, notify, user } = useApp();
  const [contactOpen, setContactOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const [requesterName, setRequesterName] = useState(user?.fullName || "");
  const [requesterPhone, setRequesterPhone] = useState(user?.phone || "");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [contactResult, setContactResult] = useState<{
    consentShared: boolean;
    phone: string | null;
    whatsappUrl: string | null;
    message: string;
  } | null>(null);

  const availabilityLabel =
    donor.availability === "available"
      ? t("statusAvailable")
      : donor.availability === "recently_donated"
        ? t("statusRecentlyDonated")
        : t("statusUnavailable");

  const availabilityColor =
    donor.availability === "available"
      ? "text-emerald-700"
      : donor.availability === "recently_donated"
        ? "text-amber-700"
        : "text-slate-500";

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requesterName.trim() || !requesterPhone.trim()) {
      notify(t("errRequiredFields"), "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<{
        consentShared: boolean;
        phone: string | null;
        whatsappUrl: string | null;
        message: string;
      }>(`/api/donors/${donor.id}/contact`, {
        method: "POST",
        body: JSON.stringify({ requesterName, requesterPhone, message }),
      });
      setContactResult(res);
      notify(res.message, "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not send request", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-slate-300 transition-colors">
      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-bold text-slate-900">
                {donor.fullName}
              </h3>
              {donor.verified && (
                <CheckCircle2
                  className="w-4 h-4 text-slate-900 shrink-0"
                  aria-label={t("verifiedLabel")}
                />
              )}
            </div>
            {/* Unboxed metadata with typographic separators */}
            <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-1.5">
              <span className={`font-semibold ${availabilityColor}`}>
                {availabilityLabel}
              </span>
              {donor.verified && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{t("verifiedLabel")}</span>
                </>
              )}
              {donor.distanceKm !== null && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-slate-700">
                    {donor.distanceKm} {t("nearestBadge")}
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="w-12 h-12 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
            <span className="font-display text-base font-extrabold text-red-700 tabular-nums">
              {donor.bloodGroup}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-sm text-slate-700">
          <MapPin className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
          <span>
            {donor.area}, {donor.city}
          </span>
        </div>

        <div className="text-xs text-slate-500">
          {donor.consentShareContact ? (
            <span className="font-mono tabular-nums text-slate-600">
              {donor.phoneMasked}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-slate-500">
              <ShieldAlert className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              {t("consentProtectedLabel")}
            </span>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setContactResult(null);
              setContactOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Phone className="w-3.5 h-3.5" aria-hidden="true" />
            {t("btnContactDonor")}
          </button>

          {donor.consentShareContact && donor.consentWhatsapp && donor.whatsappNumber && (
            <a
              href={`https://wa.me/${donor.whatsappNumber}?text=${encodeURIComponent(
                `Hello ${donor.fullName}, I found your donor profile on BloodConnect for ${donor.bloodGroup} blood in ${donor.city}.`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
              {t("btnWhatsapp")}
            </a>
          )}
        </div>

        <button
          type="button"
          onClick={() => setReportOpen(true)}
          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-slate-500 hover:text-red-700 transition-colors cursor-pointer"
        >
          <Flag className="w-3.5 h-3.5" aria-hidden="true" />
          {t("btnReportInfo")}
        </button>
      </div>

      {/* Contact Donor Modal */}
      {contactOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-display text-base font-bold text-slate-900">
                {t("contactModalTitle")} · {donor.fullName} ({donor.bloodGroup})
              </h3>
              <button
                type="button"
                onClick={() => setContactOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {contactResult ? (
              <div className="mt-4 space-y-4">
                <p className="text-sm text-slate-700 leading-relaxed">
                  {contactResult.consentShared
                    ? t("contactSuccessShared")
                    : t("contactSuccessPending")}
                </p>

                {contactResult.phone && (
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <p className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                      {contactResult.phone}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={`tel:${contactResult.phone}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Call Now
                      </a>
                      {contactResult.whatsappUrl && (
                        <a
                          href={contactResult.whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setContactOpen(false)}
                  className="w-full py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t("contactYourName")} *
                  </label>
                  <input
                    type="text"
                    required
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t("contactYourPhone")} *
                  </label>
                  <input
                    type="tel"
                    required
                    value={requesterPhone}
                    onChange={(e) => setRequesterPhone(e.target.value)}
                    placeholder="+91 98..."
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t("contactMessage")}
                  </label>
                  <textarea
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Hospital name, patient blood need..."
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setContactOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg cursor-pointer"
                  >
                    {t("btnSendContact")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {reportOpen && (
        <ReportModal
          targetType="donor"
          targetId={donor.id}
          targetName={`${donor.fullName} (${donor.bloodGroup}, ${donor.city})`}
          onClose={() => setReportOpen(false)}
        />
      )}
    </article>
  );
}
