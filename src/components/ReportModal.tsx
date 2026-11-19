import { Flag, X } from "lucide-react";
import React, { useState } from "react";
import { useApp } from "../context/AppContext";

interface ReportModalProps {
  targetType: "donor" | "request";
  targetId: number;
  targetName: string;
  onClose: () => void;
}

export function ReportModal({
  targetType,
  targetId,
  targetName,
  onClose,
}: ReportModalProps) {
  const { t, apiFetch, notify, user } = useApp();
  const [reason, setReason] = useState(t("reportReasonFake"));
  const [details, setDetails] = useState("");
  const [reporterName, setReporterName] = useState(user?.fullName || "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          targetType,
          targetId,
          reporterName: reporterName.trim() || "Visitor",
          reason,
          details,
        }),
      });
      notify(t("reportSuccess"), "success");
      onClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to submit report", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-900">
            <Flag className="w-4 h-4 text-red-600" aria-hidden="true" />
            <h3 className="font-display text-base font-bold">{t("reportModalTitle")}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <p className="text-xs text-slate-500">
            Reporting: <span className="font-semibold text-slate-800">{targetName}</span>
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t("reportReason")}
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              <option value={t("reportReasonFake")}>{t("reportReasonFake")}</option>
              <option value={t("reportReasonWrongNumber")}>{t("reportReasonWrongNumber")}</option>
              <option value={t("reportReasonWrongLocation")}>{t("reportReasonWrongLocation")}</option>
            </select>
          </div>

          {!user && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t("contactYourName")}
              </label>
              <input
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t("reportDetails")}
            </label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg cursor-pointer"
            >
              {t("btnSubmitReport")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
