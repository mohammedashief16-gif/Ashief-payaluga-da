import { AlertCircle, Search } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import type { PlatformStats, PublicDonor } from "../types";
import { DonorCard } from "./DonorCard";

const BLOOD_GROUPS = ["ALL", "O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

export function FindDonorsPage() {
  const { t, searchFilters, setSearchFilters, apiFetch, navigate } = useApp();
  const [includeUnavailable, setIncludeUnavailable] = useState(false);
  const [donors, setDonors] = useState<PublicDonor[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const runSearch = async (
    bg = searchFilters.bloodGroup,
    city = searchFilters.city,
    area = searchFilters.area,
    incl = includeUnavailable
  ) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (bg && bg !== "ALL") params.set("bloodGroup", bg);
      if (city.trim()) params.set("city", city.trim());
      if (area.trim()) params.set("area", area.trim());
      if (incl) params.set("includeUnavailable", "true");

      const data = await apiFetch<{ count: number; donors: PublicDonor[] }>(
        `/api/donors/search?${params.toString()}`
      );
      setDonors(data.donors);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load donors.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    apiFetch<PlatformStats>("/api/stats")
      .then((s) => setCities(s.cities))
      .catch(() => {});
  }, []);

  useEffect(() => {
    runSearch(
      searchFilters.bloodGroup,
      searchFilters.city,
      searchFilters.area,
      includeUnavailable
    );
  }, [searchFilters.bloodGroup, includeUnavailable]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950">
          {t("findTitle")}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 mt-1.5">{t("findSub")}</p>
      </div>

      {/* Search Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t("labelBloodGroup")}
            </label>
            <select
              value={searchFilters.bloodGroup}
              onChange={(e) =>
                setSearchFilters((prev) => ({ ...prev, bloodGroup: e.target.value }))
              }
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              <option value="ALL">{t("allBloodGroups")}</option>
              {BLOOD_GROUPS.filter((g) => g !== "ALL").map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t("labelCity")}
            </label>
            <input
              type="text"
              list="bloodconnect-cities"
              value={searchFilters.city}
              onChange={(e) =>
                setSearchFilters((prev) => ({ ...prev, city: e.target.value }))
              }
              placeholder={t("placeholderCity")}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
            />
            <datalist id="bloodconnect-cities">
              {cities.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="lg:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t("labelArea")}
            </label>
            <input
              type="text"
              value={searchFilters.area}
              onChange={(e) =>
                setSearchFilters((prev) => ({ ...prev, area: e.target.value }))
              }
              placeholder={t("placeholderArea")}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>

          <div className="lg:col-span-2">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer min-h-[42px]"
            >
              <Search className="w-4 h-4" aria-hidden="true" />
              {t("btnSearchDonors")}
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={includeUnavailable}
              onChange={(e) => setIncludeUnavailable(e.target.checked)}
              className="rounded border-slate-300 text-red-600 focus:ring-red-600"
            />
            <span>{t("includeUnavailableLabel")}</span>
          </label>

          <p className="text-xs text-slate-500 tabular-nums">
            {loading ? "..." : `${donors.length} matching records`}
          </p>
        </div>
      </form>

      {/* Medical Compatibility Notice */}
      <div className="rounded-xl bg-slate-100 border border-slate-200 px-4 py-3 flex items-start gap-2.5 text-xs text-slate-700">
        <AlertCircle className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" aria-hidden="true" />
        <span>{t("emergencyDisclaimer")}</span>
      </div>

      {/* Results */}
      {error ? (
        <div className="p-6 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 rounded-xl bg-white border border-slate-200 p-5 animate-pulse space-y-3"
            >
              <div className="h-5 w-1/2 bg-slate-200 rounded" />
              <div className="h-4 w-1/3 bg-slate-100 rounded" />
              <div className="h-10 w-full bg-slate-100 rounded mt-6" />
            </div>
          ))}
        </div>
      ) : donors.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-4">
          <h2 className="font-display text-lg font-bold text-slate-900">
            {t("noDonorsTitle")}
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            {t("noDonorsDesc")}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate("request-blood")}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
            >
              {t("btnPostRequestNow")}
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchFilters({ bloodGroup: "ALL", city: "", area: "" });
                runSearch("ALL", "", "", includeUnavailable);
              }}
              className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {donors.map((d) => (
            <DonorCard key={d.id} donor={d} />
          ))}
        </div>
      )}
    </div>
  );
}
