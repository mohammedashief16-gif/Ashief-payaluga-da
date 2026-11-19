import { AlertTriangle, CheckCircle2, HeartHandshake, MapPin } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import type { BloodRequestRow, PublicDonor } from "../types";
import { DonorCard } from "./DonorCard";

const BLOOD_GROUPS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

export function BloodRequestPage() {
  const { t, user, apiFetch, notify, navigate } = useApp();

  const [patientName, setPatientName] = useState("");
  const [bloodGroup, setBloodGroup] = useState("O+");
  const [hospitalName, setHospitalName] = useState("");
  const [city, setCity] = useState(user?.city || "");
  const [area, setArea] = useState(user?.area || "");
  const [unitsRequired, setUnitsRequired] = useState("1");
  const [requiredDate, setRequiredDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [contactPhone, setContactPhone] = useState(user?.phone || "");
  const [urgency, setUrgency] = useState<"emergency" | "normal">("emergency");
  const [additionalInfo, setAdditionalInfo] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{
    request: BloodRequestRow;
    matchingDonors: PublicDonor[];
  } | null>(null);

  const [openRequests, setOpenRequests] = useState<BloodRequestRow[]>([]);

  const loadOpenRequests = () => {
    apiFetch<{ requests: BloodRequestRow[] }>("/api/requests")
      .then((res) => setOpenRequests(res.requests))
      .catch(() => {});
  };

  useEffect(() => {
    loadOpenRequests();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !patientName.trim() ||
      !hospitalName.trim() ||
      !city.trim() ||
      !area.trim() ||
      !contactPhone.trim()
    ) {
      notify(t("errRequiredFields"), "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<{
        request: BloodRequestRow;
        matchingDonors: PublicDonor[];
        message: string;
      }>("/api/requests", {
        method: "POST",
        body: JSON.stringify({
          patientName,
          bloodGroup,
          hospitalName,
          city,
          area,
          unitsRequired: Number(unitsRequired),
          requiredDate,
          contactPhone,
          urgency,
          additionalInfo,
        }),
      });

      setSubmittedResult({
        request: res.request,
        matchingDonors: res.matchingDonors,
      });
      notify(t("requestSuccessTitle"), "success");
      loadOpenRequests();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Submission failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespondToRequest = async (requestId: number) => {
    if (!user) {
      navigate("auth");
      return;
    }
    try {
      const res = await apiFetch<{ message: string }>(
        `/api/requests/${requestId}/respond`,
        {
          method: "POST",
          body: JSON.stringify({
            message: "I am available to donate. Please contact me if needed.",
            shareContactConsent: true,
          }),
        }
      );
      notify(res.message, "success");
      loadOpenRequests();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not respond", "error");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-14">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950">
            {t("requestTitle")}
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1.5">{t("requestSub")}</p>
        </div>

        {submittedResult && (
          <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-emerald-900">
                  <CheckCircle2 className="w-5 h-5" />
                  <h2 className="font-display text-lg font-bold">
                    {t("requestSuccessTitle")}
                  </h2>
                </div>
                <span className="font-mono text-sm font-bold text-slate-900 bg-white px-3 py-1 rounded-md border border-emerald-200 tabular-nums">
                  {t("trackingCodeLabel")}: {submittedResult.request.tracking_code}
                </span>
              </div>
              <p className="text-sm text-emerald-900">
                {submittedResult.request.patient_name} ·{" "}
                <strong>{submittedResult.request.blood_group}</strong> ·{" "}
                {submittedResult.request.hospital_name} ({submittedResult.request.area},{" "}
                {submittedResult.request.city})
              </p>
              <button
                type="button"
                onClick={() => setSubmittedResult(null)}
                className="text-xs font-semibold text-emerald-800 underline cursor-pointer"
              >
                Post another request
              </button>
            </div>

            <div className="space-y-4">
              <h3 className="font-display text-xl font-bold text-slate-950">
                {t("matchingDonorsHeading")} ({submittedResult.matchingDonors.length})
              </h3>
              {submittedResult.matchingDonors.length === 0 ? (
                <div className="p-6 rounded-xl bg-white border border-slate-200 text-sm text-slate-600">
                  {t("noDonorsTitle")} — Your request is live so registered donors in{" "}
                  {submittedResult.request.city} can respond voluntarily.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {submittedResult.matchingDonors.map((d) => (
                    <DonorCard key={d.id} donor={d} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6"
        >
          {/* Urgency Segmented Control */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              {t("labelUrgency")}
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setUrgency("emergency")}
                className={`py-2.5 px-4 text-xs sm:text-sm font-semibold rounded-md transition-colors cursor-pointer ${
                  urgency === "emergency"
                    ? "bg-red-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t("urgencyEmergency")}
              </button>
              <button
                type="button"
                onClick={() => setUrgency("normal")}
                className={`py-2.5 px-4 text-xs sm:text-sm font-semibold rounded-md transition-colors cursor-pointer ${
                  urgency === "normal"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t("urgencyNormal")}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t("labelPatientName")} *
              </label>
              <input
                type="text"
                required
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
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

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t("labelHospitalName")} *
              </label>
              <input
                type="text"
                required
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                placeholder="e.g. Apollo Specialty Hospital"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              />
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

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t("labelUnits")} *
              </label>
              <input
                type="number"
                min={1}
                max={20}
                required
                value={unitsRequired}
                onChange={(e) => setUnitsRequired(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t("labelRequiredDate")} *
              </label>
              <input
                type="date"
                required
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t("labelContactNumber")} *
              </label>
              <input
                type="tel"
                required
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+91 98400 00000"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t("labelAdditionalInfo")}
              </label>
              <textarea
                rows={3}
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
          >
            {t("btnSubmitRequest")}
          </button>
        </form>
      </div>

      {/* Live Community Blood Requests Feed */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold text-slate-950">
            {t("openRequestsTitle")}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {openRequests.map((req) => (
            <div
              key={req.id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900">
                      {req.hospital_name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`font-semibold ${
                          req.urgency === "emergency" ? "text-red-700" : "text-slate-700"
                        }`}
                      >
                        {req.urgency === "emergency" ? (
                          <span className="inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                            Emergency
                          </span>
                        ) : (
                          "Normal"
                        )}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{req.tracking_code}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{req.units_required} units</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">Need by {req.required_date}</span>
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                    <span className="font-display text-sm font-extrabold text-red-700">
                      {req.blood_group}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                  <span>
                    {req.area}, {req.city} · Patient: {req.patient_name}
                  </span>
                </p>

                {req.additional_info && (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {req.additional_info}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500 tabular-nums">
                  {req.response_count ?? 0} donor response(s)
                </span>
                <button
                  type="button"
                  onClick={() => handleRespondToRequest(req.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <HeartHandshake className="w-3.5 h-3.5" aria-hidden="true" />
                  {user ? t("btnOfferToDonate") : t("btnSignInToRespond")}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
