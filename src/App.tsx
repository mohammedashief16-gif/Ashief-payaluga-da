import { X } from "lucide-react";
import { AiAssistantPage } from "./components/AiAssistantPage";
import { AuthPage } from "./components/AuthPage";
import { BloodRequestPage } from "./components/BloodRequestPage";
import { DashboardPage } from "./components/DashboardPage";
import { DonorRegisterPage } from "./components/DonorRegisterPage";
import { FindDonorsPage } from "./components/FindDonorsPage";
import { Footer } from "./components/Footer";
import { HomePage } from "./components/HomePage";
import { Navbar } from "./components/Navbar";
import { AppProvider, useApp } from "./context/AppContext";

function MainShell() {
  const { page, toasts, dismissToast } = useApp();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar />

      <main className="flex-1">
        {page === "home" && <HomePage />}
        {page === "find" && <FindDonorsPage />}
        {page === "register-donor" && <DonorRegisterPage />}
        {page === "request-blood" && <BloodRequestPage />}
        {page === "ai" && <AiAssistantPage />}
        {page === "dashboard" && <DashboardPage />}
        {page === "auth" && <AuthPage />}
      </main>

      <Footer />

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`rounded-xl px-4 py-3 text-xs font-semibold shadow-lg border flex items-center justify-between gap-3 ${
                toast.type === "error"
                  ? "bg-red-700 text-white border-red-800"
                  : toast.type === "success"
                    ? "bg-slate-900 text-white border-slate-800"
                    : "bg-white text-slate-900 border-slate-200"
              }`}
            >
              <span>{toast.message}</span>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="opacity-75 hover:opacity-100 cursor-pointer"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainShell />
    </AppProvider>
  );
}
