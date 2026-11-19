import React, { createContext, useContext, useEffect, useState } from "react";
import { TRANSLATIONS } from "../i18n/translations";
import type { AppPage, AuthUser, LanguageCode, SearchFilters } from "../types";

interface ToastItem {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

interface AppContextValue {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string) => string;
  page: AppPage;
  navigate: (next: AppPage, filters?: Partial<SearchFilters>) => void;
  searchFilters: SearchFilters;
  setSearchFilters: React.Dispatch<React.SetStateAction<SearchFilters>>;
  user: AuthUser | null;
  token: string | null;
  setSession: (token: string, user: AuthUser) => void;
  logout: () => void;
  apiFetch: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
  notify: (message: string, type?: "success" | "error" | "info") => void;
  toasts: ToastItem[];
  dismissToast: (id: number) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const LANG_KEY = "bloodconnect_lang";
const TOKEN_KEY = "bloodconnect_token";
const USER_KEY = "bloodconnect_user";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "en" || saved === "tanglish" || saved === "ta" || saved === "hi") {
      return saved;
    }
    return "en";
  });

  const [page, setPage] = useState<AppPage>("home");
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    bloodGroup: "ALL",
    city: "",
    area: "",
  });

  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  });

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    localStorage.setItem(LANG_KEY, lang);
  };

  const t = (key: string): string => {
    return TRANSLATIONS[language][key] ?? TRANSLATIONS.en[key] ?? key;
  };

  const notify = (message: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4500);
  };

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  };

  const setSession = (newToken: string, newUser: AuthUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setPage("home");
    notify(t("navSignOut"), "info");
  };

  const navigate = (next: AppPage, filters?: Partial<SearchFilters>) => {
    if (filters) {
      setSearchFilters((prev) => ({
        bloodGroup: filters.bloodGroup ?? prev.bloodGroup,
        city: filters.city ?? prev.city,
        area: filters.area ?? prev.area,
      }));
    }
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const apiFetch = async <T = unknown,>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> => {
    const headers = new Headers(options.headers || {});
    if (!headers.has("Content-Type") && options.body) {
      headers.set("Content-Type", "application/json");
    }
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
    }
    return data as T;
  };

  useEffect(() => {
    if (!token) return;
    apiFetch<{ user: AuthUser }>("/api/auth/me")
      .then((res) => {
        setUser(res.user);
        localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      })
      .catch(() => {
        setToken(null);
        setUser(null);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      });
  }, []);

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage,
        t,
        page,
        navigate,
        searchFilters,
        setSearchFilters,
        user,
        token,
        setSession,
        logout,
        apiFetch,
        notify,
        toasts,
        dismissToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
