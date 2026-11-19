import { CheckCircle2, HeartHandshake, Plus, ShieldCheck, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import type { BloodRequestRow } from "../types";
import { DonorCard } from "./DonorCard";

interface DonorDashboardData {
  donor: {
    id: number;
    fullName: string;
    age: number;
    bloodGroup: string;
    phone: string;
    city: string;
    area: string;
    availability: "available" | "unavailable" | "recently_donated";
    lastDonationDate: string;
    consentShareContact: boolean;
    consentWhatsapp: boolean;
    verified: boolean;
  } | null;
  relevantRequests: BloodRequestRow[];
  contactRequests: Array<{
    id: number;
    requester_name: string;
    requester_phone: string;
    message: string;
    status: string;
    created_at: string;
  }>;
  donationHistory: Array<{
    id: number;
    donation_date: string;
    hospital_name: string;
    city: string;
    units: number;
    notes: string;
  }>;
}

interface AdminOverview {
  metrics: {
    totalUsers: number;
    totalDonors: number;
    totalRequests: number;
    pendingReports: number;
  };
  users: Array<{
    id: number;
    full_name: string;
    email: string;
    role: string;
    city: string;
    verified: number;
    suspended: number;
  }>;
  donors: Array<{
    id: number;
    full_name: string;
    blood_group: string;
    city: string;
    area: string;
    availability: string;
    verified: number;
    suspended: number;
  }>;
  requests: BloodRequestRow[];
  reports: Array<{
    id: number;
    target_type: string;
    target_id: number;
    reporter_name: string;
    reason: string;
    details: string;
    status: string;
    admin_notes: string;
    created_at: string;
  }>;
}

export function DashboardPage() {
  const { user, t, apiFetch, notify, navigate } = useApp();
  const [activeTab, setActiveTab] = useState<"donor" | "requester" | "admin">(() => {
    if (user?.role === "admin") return "admin";
    if (user?.role === "requester") return "requester";
    return "donor";
  });

  const [donorData, setDonorData] = useState<DonorDashboardData | null>(null);
  const [myRequests, setMyRequests] = useState<BloodRequestRow[]>([]);
  const [adminData, setAdminData] = useState<AdminOverview | null>(null);
  const [adminSection, setAdminSection] = useState<
    "donors" | "requests" | "users" | "reports"
  >("donors");

  // Donor profile edit & donation log state
  const [editCity, setEditCity] = useState("");
  const [editArea, setEditArea] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [donationDate, setDonationDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [donationHospital, setDonationHospital] = useState("");
  const [donationCity, setDonationCity] = useState("");

  const loadDonorData = async () => {
    try {
      const res = await apiFetch<DonorDashboardData>("/api/donors/me");
      setDonorData(res);
      if (res.donor) {
        setEditCity(res.donor.city);
        setEditArea(res.donor.area);
        setEditPhone(res.donor.phone);
        setDonationCity(res.donor.city);
      }
    } catch {
      // ignored
    }
  };

  const loadRequesterData = async () => {
    try {
      const res = await apiFetch<{ requests: BloodRequestRow[] }>("/api/requests?mine=true");
      setMyRequests(res.requests);
    } catch {
      // ignored
    }
  };

  const loadAdminData = async () => {
    if (user?.role !== "admin") return;
    try {
      const res = await apiFetch<AdminOverview>("/api/admin/overview");
      setAdminData(res);
    } catch {
      // ignored
    }
  };

  useEffect(() => {
    if (!user) return;
    loadDonorData();
    loadRequesterData();
    if (user.role === "admin") {
      loadAdminData();
    }
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-slate-950">
          {t("authTitleSignIn")}
        </h1>
        <button
          type="button"
          onClick={() => navigate("auth")}
          className="px-6 py-3 text-sm font-semibold text-white bg-red-600 rounded-lg cursor-pointer"
        >
          {t("btnSignIn")}
        </button>
      </div>
    );
  }

  const updateDonorField = async (patch: Record<string, unknown>) => {
    try {
      await apiFetch("/api/donors/me", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      notify("Profile updated", "success");
      loadDonorData();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Update failed", "error");
    }
  };

  const handleRespondToBloodRequest = async (reqId: number) => {
    try {
      const res = await apiFetch<{ message: string }>(`/api/requests/${reqId}/respond`, {
        method: "POST",
        body: JSON.stringify({
          message: "Available to donate. Contact me via BloodConnect.",
          shareContactConsent: donorData?.donor?.consentShareContact ?? true,
        }),
      });
      notify(res.message, "success");
      loadDonorData();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to respond", "error");
    }
  };

  const handleLogDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/api/donors/donations", {
        method: "POST",
        body: JSON.stringify({
          donationDate,
          hospitalName: donationHospital,
          city: donationCity,
          units: 1,
        }),
      });
      setDonationHospital("");
      notify("Donation record added", "success");
      loadDonorData();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not add donation", "error");
    }
  };

  const handleContactAction = async (crId: number, status: "shared" | "declined") => {
    try {
      await apiFetch(`/api/contact-requests/${crId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      notify(`Contact request ${status}`, "success");
      loadDonorData();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Action failed", "error");
    }
  };

  const handleUpdateRequestStatus = async (reqId: number, status: string) => {
    try {
      await apiFetch(`/api/requests/${reqId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      notify(`Request marked ${status}`, "success");
      loadRequesterData();
      if (user.role === "admin") loadAdminData();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Update failed", "error");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header + Role Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-950">
            {user.fullName}
          </h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
            <span className="capitalize font-semibold text-slate-700">{user.role}</span>
            <span aria-hidden="true">·</span>
            <span>{user.email}</span>
            {user.verified && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-700 font-semibold">{t("verifiedLabel")}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setActiveTab("donor")}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === "donor"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t("dashDonorTab")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("requester")}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === "requester"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t("dashRequesterTab")}
          </button>
          {user.role === "admin" && (
            <button
              type="button"
              onClick={() => setActiveTab("admin")}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                activeTab === "admin"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t("dashAdminTab")}
            </button>
          )}
        </div>
      </div>

      {/* DONOR DASHBOARD */}
      {activeTab === "donor" && (
        <div className="space-y-8">
          {!donorData?.donor ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
              <h2 className="font-display text-xl font-bold text-slate-900">
                Complete Your Donor Profile
              </h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Register your blood group, location, and contact consent to appear in donor searches and respond to requests.
              </p>
              <button
                type="button"
                onClick={() => navigate("register-donor")}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
              >
                {t("navBecomeDonor")}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Profile, Blood Group, Availability Toggle */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">My Blood Group</p>
                      <p className="font-display text-4xl font-extrabold text-red-700 mt-1">
                        {donorData.donor.bloodGroup}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Verification</p>
                      <p className="text-xs font-semibold text-slate-900 mt-1 inline-flex items-center gap-1">
                        <ShieldCheck className="w-4 h-4 text-emerald-700" />
                        {donorData.donor.verified ? t("verifiedLabel") : "Standard"}
                      </p>
                    </div>
                  </div>

                  {/* Availability Toggle */}
                  <div className="pt-4 border-t border-slate-100 space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      {t("dashAvailabilityToggle")}
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg">
                      {(
                        [
                          ["available", t("statusAvailable")],
                          ["unavailable", t("statusUnavailable")],
                          ["recently_donated", t("statusRecentlyDonated")],
                        ] as const
                      ).map(([val, label]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => updateDonorField({ availability: val })}
                          className={`py-2 px-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                            donorData.donor!.availability === val
                              ? val === "available"
                                ? "bg-emerald-700 text-white"
                                : "bg-slate-900 text-white"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick Profile & Privacy Update */}
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          {t("labelCity")}
                        </label>
                        <input
                          type="text"
                          value={editCity}
                          onChange={(e) => setEditCity(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          {t("labelArea")}
                        </label>
                        <input
                          type="text"
                          value={editArea}
                          onChange={(e) => setEditArea(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        {t("labelPhone")}
                      </label>
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={donorData.donor.consentShareContact}
                        onChange={(e) =>
                          updateDonorField({ consentShareContact: e.target.checked })
                        }
                        className="rounded border-slate-300 text-red-600"
                      />
                      <span>{t("labelConsentShare")}</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={donorData.donor.consentWhatsapp}
                        onChange={(e) =>
                          updateDonorField({ consentWhatsapp: e.target.checked })
                        }
                        className="rounded border-slate-300 text-red-600"
                      />
                      <span>{t("labelConsentWhatsapp")}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        updateDonorField({
                          city: editCity,
                          area: editArea,
                          phone: editPhone,
                        })
                      }
                      className="w-full py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                    >
                      Save Profile Details
                    </button>
                  </div>
                </div>

                {/* Donation History */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                  <h2 className="font-display text-lg font-bold text-slate-950">
                    {t("dashDonationHistory")}
                  </h2>

                  <form onSubmit={handleLogDonation} className="space-y-2.5 pb-4 border-b border-slate-100">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        required
                        value={donationDate}
                        onChange={(e) => setDonationDate(e.target.value)}
                        className="px-3 py-2 text-xs border border-slate-200 rounded-lg"
                      />
                      <input
                        type="text"
                        required
                        placeholder={t("labelCity")}
                        value={donationCity}
                        onChange={(e) => setDonationCity(e.target.value)}
                        className="px-3 py-2 text-xs border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        placeholder={t("labelHospitalName")}
                        value={donationHospital}
                        onChange={(e) => setDonationHospital(e.target.value)}
                        className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg"
                      />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {t("dashAddDonation")}
                      </button>
                    </div>
                  </form>

                  <div className="space-y-2">
                    {donorData.donationHistory.length === 0 ? (
                      <p className="text-xs text-slate-500">No donations logged yet.</p>
                    ) : (
                      donorData.donationHistory.map((h) => (
                        <div
                          key={h.id}
                          className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center justify-between gap-2"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">{h.hospital_name}</p>
                            <p className="text-slate-500">{h.city}</p>
                          </div>
                          <span className="font-mono tabular-nums text-slate-700">
                            {h.donation_date}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Relevant Blood Requests + Contact Requests */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                  <h2 className="font-display text-lg font-bold text-slate-950">
                    {t("dashRelevantRequests")} ({donorData.relevantRequests.length})
                  </h2>

                  {donorData.relevantRequests.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No open requests matching your city or blood group right now.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {donorData.relevantRequests.map((req) => (
                        <div
                          key={req.id}
                          className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <p className="font-display text-sm font-bold text-slate-900">
                              {req.hospital_name} · {req.blood_group}
                            </p>
                            <p className="text-xs text-slate-500">
                              {req.area}, {req.city} · {req.units_required} units ·{" "}
                              {req.urgency === "emergency" ? "Emergency" : "Normal"} · Need by{" "}
                              {req.required_date}
                            </p>
                          </div>
                          {req.already_responded ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 shrink-0">
                              <CheckCircle2 className="w-4 h-4" />
                              Responded
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRespondToBloodRequest(req.id)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shrink-0 cursor-pointer"
                            >
                              <HeartHandshake className="w-3.5 h-3.5" />
                              {t("btnOfferToDonate")}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                  <h2 className="font-display text-lg font-bold text-slate-950">
                    {t("dashContactRequests")} ({donorData.contactRequests.length})
                  </h2>
                  {donorData.contactRequests.length === 0 ? (
                    <p className="text-sm text-slate-500">No contact requests yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {donorData.contactRequests.map((cr) => (
                        <div
                          key={cr.id}
                          className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-900">
                              {cr.requester_name} ·{" "}
                              <span className="font-mono tabular-nums">{cr.requester_phone}</span>
                            </p>
                            {cr.message && (
                              <p className="text-xs text-slate-600">{cr.message}</p>
                            )}
                            <p className="text-xs text-slate-500 capitalize">
                              Status: {cr.status}
                            </p>
                          </div>

                          {cr.status === "pending" && (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleContactAction(cr.id, "shared")}
                                className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleContactAction(cr.id, "declined")}
                                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg cursor-pointer"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* REQUESTER DASHBOARD */}
      {activeTab === "requester" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-slate-950">
              {t("dashMyRequests")} ({myRequests.length})
            </h2>
            <button
              type="button"
              onClick={() => navigate("request-blood")}
              className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
            >
              + {t("ctaRequestBlood")}
            </button>
          </div>

          {myRequests.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
              <p className="text-sm text-slate-600">
                You have not submitted any blood requests while signed in yet.
              </p>
              <button
                type="button"
                onClick={() => navigate("request-blood")}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg cursor-pointer"
              >
                {t("ctaRequestBlood")}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {myRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {req.tracking_code}
                        </span>
                        <h3 className="font-display text-lg font-bold text-slate-950">
                          {req.patient_name} · {req.blood_group}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {req.hospital_name} · {req.area}, {req.city} · {req.units_required}{" "}
                        units · Status:{" "}
                        <strong className="uppercase text-slate-900">{req.status}</strong>
                      </p>
                    </div>

                    {req.status !== "fulfilled" && req.status !== "cancelled" && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateRequestStatus(req.id, "fulfilled")}
                          className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
                        >
                          {t("dashMarkFulfilled")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateRequestStatus(req.id, "cancelled")}
                          className="px-3.5 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Donor Responses */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-700">
                      {t("dashDonorResponses")} ({req.responses?.length ?? 0})
                    </h4>
                    {!req.responses || req.responses.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        Waiting for voluntary donor responses. You can also contact matching donors below.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {req.responses.map((resp) => (
                          <div
                            key={resp.id}
                            className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs space-y-1"
                          >
                            <p className="font-bold text-slate-900">
                              {resp.donor_name} ({resp.donor_blood_group}) · {resp.donor_area},{" "}
                              {resp.donor_city}
                            </p>
                            <p className="text-slate-700">{resp.message}</p>
                            {resp.donor_phone ? (
                              <p className="font-mono font-bold text-emerald-900 pt-1">
                                Contact: {resp.donor_phone}
                              </p>
                            ) : (
                              <p className="text-slate-500">
                                Donor chose to keep phone private until direct confirmation.
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Matching Donors */}
                  {req.matchingDonors && req.matchingDonors.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <h4 className="text-xs font-semibold text-slate-700">
                        {t("matchingDonorsHeading")} ({req.matchingDonors.length})
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {req.matchingDonors.slice(0, 4).map((d) => (
                          <DonorCard key={d.id} donor={d} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ADMIN DASHBOARD */}
      {activeTab === "admin" && user.role === "admin" && adminData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-white border border-slate-200">
              <p className="text-xs text-slate-500">{t("dashAdminUsers")}</p>
              <p className="font-display text-3xl font-extrabold text-slate-950 mt-1 tabular-nums">
                {adminData.metrics.totalUsers}
              </p>
            </div>
            <div className="p-5 rounded-xl bg-white border border-slate-200">
              <p className="text-xs text-slate-500">{t("dashAdminDonors")}</p>
              <p className="font-display text-3xl font-extrabold text-slate-950 mt-1 tabular-nums">
                {adminData.metrics.totalDonors}
              </p>
            </div>
            <div className="p-5 rounded-xl bg-white border border-slate-200">
              <p className="text-xs text-slate-500">{t("dashAdminRequests")}</p>
              <p className="font-display text-3xl font-extrabold text-slate-950 mt-1 tabular-nums">
                {adminData.metrics.totalRequests}
              </p>
            </div>
            <div className="p-5 rounded-xl bg-red-50 border border-red-200">
              <p className="text-xs text-red-800">{t("dashAdminReports")}</p>
              <p className="font-display text-3xl font-extrabold text-red-700 mt-1 tabular-nums">
                {adminData.metrics.pendingReports}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            {(
              [
                ["donors", t("dashAdminDonors")],
                ["requests", t("dashAdminRequests")],
                ["users", t("dashAdminUsers")],
                ["reports", t("dashAdminReports")],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setAdminSection(k)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                  adminSection === k ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {adminSection === "donors" && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Donor</th>
                    <th className="px-4 py-3 font-semibold">Blood</th>
                    <th className="px-4 py-3 font-semibold">Location</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adminData.donors.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {d.full_name}
                        {d.verified ? " · Verified" : ""}
                        {d.suspended ? " · Suspended" : ""}
                      </td>
                      <td className="px-4 py-3 font-bold text-red-700">{d.blood_group}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {d.area}, {d.city}
                      </td>
                      <td className="px-4 py-3 text-slate-600 capitalize">{d.availability}</td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/donors/${d.id}`, {
                              method: "PATCH",
                              body: JSON.stringify({ verified: !d.verified }),
                            });
                            loadAdminData();
                          }}
                          className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"
                        >
                          {d.verified ? t("btnUnverify") : t("btnVerify")}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/donors/${d.id}`, {
                              method: "PATCH",
                              body: JSON.stringify({ suspended: !d.suspended }),
                            });
                            loadAdminData();
                          }}
                          className="px-2.5 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 cursor-pointer"
                        >
                          {d.suspended ? t("btnRestore") : t("btnSuspend")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {adminSection === "requests" && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Code / Patient</th>
                    <th className="px-4 py-3 font-semibold">Blood</th>
                    <th className="px-4 py-3 font-semibold">Hospital</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adminData.requests.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        <span className="font-mono">{r.tracking_code}</span> · {r.patient_name}
                      </td>
                      <td className="px-4 py-3 font-bold text-red-700">{r.blood_group}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {r.hospital_name} ({r.city})
                      </td>
                      <td className="px-4 py-3 capitalize">{r.status}</td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleUpdateRequestStatus(r.id, "fulfilled")}
                          className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"
                        >
                          {t("dashMarkFulfilled")}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/requests/${r.id}`, {
                              method: "DELETE",
                            });
                            loadAdminData();
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          {t("btnDelete")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {adminSection === "users" && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adminData.users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {u.full_name}
                        {u.verified ? " · Verified" : ""}
                        {u.suspended ? " · Suspended" : ""}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{u.email}</td>
                      <td className="px-4 py-3 capitalize">{u.role}</td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/users/${u.id}`, {
                              method: "PATCH",
                              body: JSON.stringify({ verified: !u.verified }),
                            });
                            loadAdminData();
                          }}
                          className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"
                        >
                          {u.verified ? t("btnUnverify") : t("btnVerify")}
                        </button>
                        {u.role !== "admin" && (
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/api/admin/users/${u.id}`, {
                                method: "PATCH",
                                body: JSON.stringify({ suspended: !u.suspended }),
                              });
                              loadAdminData();
                            }}
                            className="px-2.5 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 cursor-pointer"
                          >
                            {u.suspended ? t("btnRestore") : t("btnSuspend")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {adminSection === "reports" && (
            <div className="space-y-3">
              {adminData.reports.map((rep) => (
                <div
                  key={rep.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900">
                      {rep.target_type.toUpperCase()} #{rep.target_id} · {rep.reason}
                    </p>
                    <p className="text-slate-600">{rep.details}</p>
                    <p className="text-slate-400">
                      Reported by {rep.reporter_name} · Status:{" "}
                      <strong className="uppercase text-slate-700">{rep.status}</strong>
                    </p>
                  </div>

                  {rep.status === "pending" && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/reports/${rep.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ status: "resolved" }),
                          });
                          loadAdminData();
                        }}
                        className="px-3 py-1.5 font-semibold text-white bg-emerald-700 rounded-lg cursor-pointer"
                      >
                        {t("btnResolve")}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/reports/${rep.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ status: "dismissed" }),
                          });
                          loadAdminData();
                        }}
                        className="px-3 py-1.5 font-semibold text-slate-700 border border-slate-200 rounded-lg cursor-pointer"
                      >
                        {t("btnDismiss")}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
