export type LanguageCode = "en" | "tanglish" | "ta" | "hi";

export type AppPage =
  | "home"
  | "find"
  | "register-donor"
  | "request-blood"
  | "ai"
  | "dashboard"
  | "auth";

export type UserRole = "donor" | "requester" | "admin";

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  phone?: string;
  city?: string;
  area?: string;
  verified: boolean;
}

export interface PublicDonor {
  id: number;
  fullName: string;
  age: number;
  bloodGroup: string;
  city: string;
  area: string;
  availability: "available" | "unavailable" | "recently_donated";
  lastDonationDate: string;
  consentShareContact: boolean;
  consentWhatsapp: boolean;
  verified: boolean;
  phoneMasked: string;
  whatsappNumber: string | null;
  distanceKm: number | null;
}

export interface PlatformStats {
  totalDonors: number;
  availableDonors: number;
  totalRequests: number;
  emergencyRequests: number;
  bloodGroupCounts: Array<{
    bloodGroup: string;
    total: number;
    available: number;
  }>;
  cities: string[];
}

export interface BloodRequestRow {
  id: number;
  requester_user_id: number | null;
  patient_name: string;
  blood_group: string;
  hospital_name: string;
  city: string;
  area: string;
  units_required: number;
  required_date: string;
  contact_phone: string;
  urgency: "emergency" | "normal";
  additional_info: string;
  status: "open" | "responded" | "fulfilled" | "cancelled";
  tracking_code: string;
  created_at: string;
  response_count?: number;
  already_responded?: number;
  responses?: Array<{
    id: number;
    donor_id: number;
    donor_name: string;
    donor_blood_group: string;
    donor_city: string;
    donor_area: string;
    donor_phone: string | null;
    consent_share_contact: number;
    message: string;
    status: string;
    created_at: string;
  }>;
  matchingDonors?: PublicDonor[];
}

export interface SearchFilters {
  bloodGroup: string;
  city: string;
  area: string;
}
