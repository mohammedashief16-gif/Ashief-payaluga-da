import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";
import {
  BLOOD_GROUPS,
  db,
  haversineKm,
  initDatabase,
  resolveCoordinates,
  type UserRole,
} from "./server/db.ts";
import { runBloodConnectAi } from "./server/ai.ts";

initDatabase();

const app = express();
app.use(express.json({ limit: "1mb" }));

const JWT_SECRET =
  process.env.JWT_SECRET || "bloodconnect_dev_secret_change_in_production";
const PORT = Number(process.env.PORT || 3000);

interface AuthPayload {
  id: number;
  email: string;
  role: UserRole;
  fullName: string;
}

interface AuthedRequest extends Request {
  user?: AuthPayload | null;
}

function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function attachUser(req: AuthedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
      const userRow = db
        .prepare("SELECT id, email, role, full_name, suspended FROM users WHERE id = ?")
        .get(decoded.id) as
        | { id: number; email: string; role: UserRole; full_name: string; suspended: number }
        | undefined;
      if (userRow && !userRow.suspended) {
        req.user = {
          id: userRow.id,
          email: userRow.email,
          role: userRow.role,
          fullName: userRow.full_name,
        };
      } else {
        req.user = null;
      }
    } catch {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required. Please sign in." });
    return;
  }
  next();
}

function requireRole(roles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "You do not have permission for this action." });
      return;
    }
    next();
  };
}

app.use(attachUser);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "BloodConnect" });
});

// Public platform statistics
app.get("/api/stats", (_req, res) => {
  const totalDonors = (
    db.prepare("SELECT COUNT(*) AS count FROM donors WHERE suspended = 0").get() as {
      count: number;
    }
  ).count;

  const availableDonors = (
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM donors WHERE suspended = 0 AND availability = 'available'"
      )
      .get() as { count: number }
  ).count;

  const totalRequests = (
    db.prepare("SELECT COUNT(*) AS count FROM blood_requests").get() as { count: number }
  ).count;

  const emergencyRequests = (
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM blood_requests WHERE urgency = 'emergency' AND status IN ('open', 'responded')"
      )
      .get() as { count: number }
  ).count;

  const groupRows = db
    .prepare(
      `SELECT blood_group,
              COUNT(*) AS total,
              SUM(CASE WHEN availability = 'available' THEN 1 ELSE 0 END) AS available
       FROM donors
       WHERE suspended = 0
       GROUP BY blood_group`
    )
    .all() as Array<{ blood_group: string; total: number; available: number }>;

  const bloodGroupCounts = BLOOD_GROUPS.map((bg) => {
    const match = groupRows.find((r) => r.blood_group === bg);
    return {
      bloodGroup: bg,
      total: match?.total ?? 0,
      available: match?.available ?? 0,
    };
  });

  const cities = (
    db
      .prepare("SELECT DISTINCT city FROM donors WHERE suspended = 0 ORDER BY city ASC")
      .all() as Array<{ city: string }>
  ).map((c) => c.city);

  res.json({
    totalDonors,
    availableDonors,
    totalRequests,
    emergencyRequests,
    bloodGroupCounts,
    cities,
  });
});

// Auth: Register
app.post("/api/auth/register", (req, res) => {
  const { fullName, email, password, role, phone, city, area } = req.body as {
    fullName?: string;
    email?: string;
    password?: string;
    role?: string;
    phone?: string;
    city?: string;
    area?: string;
  };

  if (!fullName || !email || !password) {
    res.status(400).json({ error: "Full name, email, and password are required." });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters long." });
    return;
  }

  const assignedRole: UserRole =
    role === "requester" ? "requester" : "donor";

  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(normalizedEmail);
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      `INSERT INTO users (full_name, email, password_hash, role, phone, city, area)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      fullName.trim(),
      normalizedEmail,
      hash,
      assignedRole,
      (phone || "").trim(),
      (city || "").trim(),
      (area || "").trim()
    );

  const userId = Number(info.lastInsertRowid);
  const payload: AuthPayload = {
    id: userId,
    email: normalizedEmail,
    role: assignedRole,
    fullName: fullName.trim(),
  };

  res.status(201).json({
    token: signToken(payload),
    user: {
      id: userId,
      fullName: fullName.trim(),
      email: normalizedEmail,
      role: assignedRole,
      phone: (phone || "").trim(),
      city: (city || "").trim(),
      area: (area || "").trim(),
      verified: false,
    },
  });
});

// Auth: Login
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const userRow = db
    .prepare(
      `SELECT id, full_name, email, password_hash, role, phone, city, area, verified, suspended
       FROM users WHERE email = ?`
    )
    .get(normalizedEmail) as
    | {
        id: number;
        full_name: string;
        email: string;
        password_hash: string;
        role: UserRole;
        phone: string;
        city: string;
        area: string;
        verified: number;
        suspended: number;
      }
    | undefined;

  if (!userRow || !bcrypt.compareSync(password, userRow.password_hash)) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  if (userRow.suspended) {
    res.status(403).json({
      error: "This account has been suspended by an administrator.",
    });
    return;
  }

  const payload: AuthPayload = {
    id: userRow.id,
    email: userRow.email,
    role: userRow.role,
    fullName: userRow.full_name,
  };

  res.json({
    token: signToken(payload),
    user: {
      id: userRow.id,
      fullName: userRow.full_name,
      email: userRow.email,
      role: userRow.role,
      phone: userRow.phone,
      city: userRow.city,
      area: userRow.area,
      verified: Boolean(userRow.verified),
    },
  });
});

// Auth: Current user
app.get("/api/auth/me", requireAuth, (req: AuthedRequest, res) => {
  const userRow = db
    .prepare(
      `SELECT id, full_name, email, role, phone, city, area, verified
       FROM users WHERE id = ?`
    )
    .get(req.user!.id) as {
    id: number;
    full_name: string;
    email: string;
    role: UserRole;
    phone: string;
    city: string;
    area: string;
    verified: number;
  };

  res.json({
    user: {
      id: userRow.id,
      fullName: userRow.full_name,
      email: userRow.email,
      role: userRow.role,
      phone: userRow.phone,
      city: userRow.city,
      area: userRow.area,
      verified: Boolean(userRow.verified),
    },
  });
});

// Helper to sanitize donor output (never expose phone unless donor consented)
function formatPublicDonor(
  row: {
    id: number;
    full_name: string;
    age: number;
    blood_group: string;
    phone: string;
    city: string;
    area: string;
    latitude: number | null;
    longitude: number | null;
    availability: string;
    last_donation_date: string;
    consent_share_contact: number;
    consent_whatsapp: number;
    verified: number;
  },
  searchCoords: { lat: number | null; lng: number | null },
  searchArea: string
) {
  let distanceKm: number | null = null;
  let proximityRank = 9999;

  const areaLower = searchArea.trim().toLowerCase();
  const donorAreaLower = row.area.trim().toLowerCase();

  if (areaLower && donorAreaLower === areaLower) {
    proximityRank = 0;
    distanceKm = 0.5;
  } else if (areaLower && donorAreaLower.includes(areaLower)) {
    proximityRank = 1;
    distanceKm = 1.5;
  } else if (
    searchCoords.lat !== null &&
    searchCoords.lng !== null &&
    row.latitude !== null &&
    row.longitude !== null
  ) {
    const km = haversineKm(
      searchCoords.lat,
      searchCoords.lng,
      row.latitude,
      row.longitude
    );
    distanceKm = km;
    proximityRank = km + 2;
  }

  const consentShare = Boolean(row.consent_share_contact);
  const consentWhatsapp = consentShare && Boolean(row.consent_whatsapp);

  return {
    id: row.id,
    fullName: row.full_name,
    age: row.age,
    bloodGroup: row.blood_group,
    city: row.city,
    area: row.area,
    availability: row.availability,
    lastDonationDate: row.last_donation_date || "",
    consentShareContact: consentShare,
    consentWhatsapp,
    verified: Boolean(row.verified),
    // Protect personal contact information: mask phone in list; reveal only via explicit consent check
    phoneMasked: consentShare
      ? `${row.phone.slice(0, 4)}****${row.phone.slice(-3)}`
      : "Protected (Platform Request Only)",
    whatsappNumber: consentWhatsapp ? row.phone.replace(/[^0-9]/g, "") : null,
    distanceKm,
    proximityRank,
  };
}

// Search Donors
app.get("/api/donors/search", (req, res) => {
  const bloodGroup = String(req.query.bloodGroup || "").trim().toUpperCase();
  const city = String(req.query.city || "").trim();
  const area = String(req.query.area || "").trim();
  const includeUnavailable = String(req.query.includeUnavailable || "false") === "true";

  let sql = `
    SELECT id, full_name, age, blood_group, phone, city, area,
           latitude, longitude, availability, last_donation_date,
           consent_share_contact, consent_whatsapp, verified
    FROM donors
    WHERE suspended = 0
  `;
  const params: string[] = [];

  if (bloodGroup && bloodGroup !== "ALL") {
    sql += ` AND UPPER(blood_group) = ?`;
    params.push(bloodGroup);
  }

  if (city) {
    sql += ` AND LOWER(city) LIKE ?`;
    params.push(`%${city.toLowerCase()}%`);
  }

  if (!includeUnavailable) {
    sql += ` AND availability = 'available'`;
  }

  const rows = db.prepare(sql).all(...params) as Array<{
    id: number;
    full_name: string;
    age: number;
    blood_group: string;
    phone: string;
    city: string;
    area: string;
    latitude: number | null;
    longitude: number | null;
    availability: string;
    last_donation_date: string;
    consent_share_contact: number;
    consent_whatsapp: number;
    verified: number;
  }>;

  const searchCoords = city ? resolveCoordinates(city, area) : { lat: null, lng: null };

  const formatted = rows
    .map((r) => formatPublicDonor(r, searchCoords, area))
    .sort((a, b) => {
      // Available first, then nearest proximity, then verified
      if (a.availability === "available" && b.availability !== "available") return -1;
      if (a.availability !== "available" && b.availability === "available") return 1;
      if (a.proximityRank !== b.proximityRank) return a.proximityRank - b.proximityRank;
      return Number(b.verified) - Number(a.verified);
    })
    .map(({ proximityRank: _p, ...rest }) => rest);

  res.json({
    count: formatted.length,
    donors: formatted,
  });
});

// Donor Registration
app.post("/api/donors/register", (req: AuthedRequest, res) => {
  const {
    fullName,
    age,
    bloodGroup,
    phone,
    city,
    area,
    availability,
    lastDonationDate,
    consentShareContact,
    consentWhatsapp,
    email,
    password,
  } = req.body as {
    fullName?: string;
    age?: number | string;
    bloodGroup?: string;
    phone?: string;
    city?: string;
    area?: string;
    availability?: string;
    lastDonationDate?: string;
    consentShareContact?: boolean;
    consentWhatsapp?: boolean;
    email?: string;
    password?: string;
  };

  if (!fullName?.trim() || !bloodGroup?.trim() || !phone?.trim() || !city?.trim() || !area?.trim()) {
    res.status(400).json({
      error: "Full name, blood group, phone number, city, and area are required.",
    });
    return;
  }

  const parsedAge = Number(age);
  if (!Number.isFinite(parsedAge) || parsedAge < 18 || parsedAge > 65) {
    res.status(400).json({
      error: "Donor age must be between 18 and 65 years for eligibility.",
    });
    return;
  }

  const bgUpper = bloodGroup.trim().toUpperCase();
  if (!BLOOD_GROUPS.includes(bgUpper as (typeof BLOOD_GROUPS)[number])) {
    res.status(400).json({ error: "Please select a valid blood group." });
    return;
  }

  const cleanedPhone = phone.trim();
  if (cleanedPhone.replace(/[^0-9]/g, "").length < 8) {
    res.status(400).json({ error: "Please enter a valid phone number." });
    return;
  }

  const validAvailability =
    availability === "unavailable" || availability === "recently_donated"
      ? availability
      : "available";

  let userId: number | null = req.user?.id ?? null;
  let issuedToken: string | null = null;
  let issuedUser: {
    id: number;
    fullName: string;
    email: string;
    role: UserRole;
    verified: boolean;
  } | null = null;

  // If not signed in and email+password provided, create donor user account automatically
  if (!userId && email && password) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      res.status(400).json({ error: "Please enter a valid email address." });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters." });
      return;
    }
    const exists = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(normalizedEmail);
    if (exists) {
      res.status(409).json({
        error: "An account with this email already exists. Please sign in first.",
      });
      return;
    }
    const hash = bcrypt.hashSync(password, 10);
    const uRes = db
      .prepare(
        `INSERT INTO users (full_name, email, password_hash, role, phone, city, area)
         VALUES (?, ?, ?, 'donor', ?, ?, ?)`
      )
      .run(
        fullName.trim(),
        normalizedEmail,
        hash,
        cleanedPhone,
        city.trim(),
        area.trim()
      );
    userId = Number(uRes.lastInsertRowid);
    const payload: AuthPayload = {
      id: userId,
      email: normalizedEmail,
      role: "donor",
      fullName: fullName.trim(),
    };
    issuedToken = signToken(payload);
    issuedUser = {
      id: userId,
      fullName: fullName.trim(),
      email: normalizedEmail,
      role: "donor",
      verified: false,
    };
  }

  const coords = resolveCoordinates(city, area);
  const shareFlag = consentShareContact ? 1 : 0;
  const waFlag = consentShareContact && consentWhatsapp ? 1 : 0;

  // If user already has a donor profile, update it
  if (userId) {
    const existingDonor = db
      .prepare("SELECT id FROM donors WHERE user_id = ?")
      .get(userId) as { id: number } | undefined;

    if (existingDonor) {
      db.prepare(
        `UPDATE donors SET
          full_name = ?, age = ?, blood_group = ?, phone = ?, city = ?, area = ?,
          latitude = ?, longitude = ?, availability = ?, last_donation_date = ?,
          consent_share_contact = ?, consent_whatsapp = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        fullName.trim(),
        parsedAge,
        bgUpper,
        cleanedPhone,
        city.trim(),
        area.trim(),
        coords.lat,
        coords.lng,
        validAvailability,
        (lastDonationDate || "").trim(),
        shareFlag,
        waFlag,
        existingDonor.id
      );

      const updated = db
        .prepare("SELECT * FROM donors WHERE id = ?")
        .get(existingDonor.id);
      res.json({
        donor: updated,
        token: issuedToken,
        user: issuedUser,
        message: "Donor profile updated successfully.",
      });
      return;
    }
  }

  const insertRes = db
    .prepare(
      `INSERT INTO donors (
        user_id, full_name, age, blood_group, phone, city, area,
        latitude, longitude, availability, last_donation_date,
        consent_share_contact, consent_whatsapp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      fullName.trim(),
      parsedAge,
      bgUpper,
      cleanedPhone,
      city.trim(),
      area.trim(),
      coords.lat,
      coords.lng,
      validAvailability,
      (lastDonationDate || "").trim(),
      shareFlag,
      waFlag
    );

  const created = db
    .prepare("SELECT * FROM donors WHERE id = ?")
    .get(Number(insertRes.lastInsertRowid));

  res.status(201).json({
    donor: created,
    token: issuedToken,
    user: issuedUser,
    message: "Donor registration completed successfully.",
  });
});

// Donor Dashboard Data
app.get("/api/donors/me", requireAuth, (req: AuthedRequest, res) => {
  const donor = db
    .prepare("SELECT * FROM donors WHERE user_id = ?")
    .get(req.user!.id) as
    | {
        id: number;
        user_id: number;
        full_name: string;
        age: number;
        blood_group: string;
        phone: string;
        city: string;
        area: string;
        availability: string;
        last_donation_date: string;
        consent_share_contact: number;
        consent_whatsapp: number;
        verified: number;
      }
    | undefined;

  if (!donor) {
    res.json({ donor: null, relevantRequests: [], contactRequests: [], donationHistory: [] });
    return;
  }

  // Relevant blood requests (matching city or blood group and open)
  const relevantRequests = db
    .prepare(
      `SELECT br.*,
              EXISTS(SELECT 1 FROM request_responses rr WHERE rr.request_id = br.id AND rr.donor_id = ?) AS already_responded
       FROM blood_requests br
       WHERE br.status IN ('open', 'responded')
         AND (UPPER(br.blood_group) = UPPER(?) OR LOWER(br.city) = LOWER(?))
       ORDER BY CASE WHEN br.urgency = 'emergency' THEN 0 ELSE 1 END, br.id DESC
       LIMIT 20`
    )
    .all(donor.id, donor.blood_group, donor.city);

  const contactRequests = db
    .prepare(
      `SELECT * FROM contact_requests WHERE donor_id = ? ORDER BY id DESC`
    )
    .all(donor.id);

  const donationHistory = db
    .prepare(
      `SELECT * FROM donation_history WHERE donor_id = ? ORDER BY donation_date DESC, id DESC`
    )
    .all(donor.id);

  res.json({
    donor: {
      id: donor.id,
      fullName: donor.full_name,
      age: donor.age,
      bloodGroup: donor.blood_group,
      phone: donor.phone,
      city: donor.city,
      area: donor.area,
      availability: donor.availability,
      lastDonationDate: donor.last_donation_date || "",
      consentShareContact: Boolean(donor.consent_share_contact),
      consentWhatsapp: Boolean(donor.consent_whatsapp),
      verified: Boolean(donor.verified),
    },
    relevantRequests,
    contactRequests,
    donationHistory,
  });
});

// Update Donor Profile / Availability Toggle
app.patch("/api/donors/me", requireAuth, (req: AuthedRequest, res) => {
  const donor = db
    .prepare("SELECT * FROM donors WHERE user_id = ?")
    .get(req.user!.id) as { id: number; city: string; area: string } | undefined;

  if (!donor) {
    res.status(404).json({ error: "Donor profile not found. Please register as a donor first." });
    return;
  }

  const {
    fullName,
    age,
    bloodGroup,
    phone,
    city,
    area,
    availability,
    lastDonationDate,
    consentShareContact,
    consentWhatsapp,
  } = req.body as Record<string, unknown>;

  const updates: string[] = [];
  const values: unknown[] = [];

  if (typeof fullName === "string" && fullName.trim()) {
    updates.push("full_name = ?");
    values.push(fullName.trim());
  }
  if (age !== undefined) {
    const numAge = Number(age);
    if (!Number.isFinite(numAge) || numAge < 18 || numAge > 65) {
      res.status(400).json({ error: "Age must be between 18 and 65." });
      return;
    }
    updates.push("age = ?");
    values.push(numAge);
  }
  if (typeof bloodGroup === "string" && BLOOD_GROUPS.includes(bloodGroup.toUpperCase() as (typeof BLOOD_GROUPS)[number])) {
    updates.push("blood_group = ?");
    values.push(bloodGroup.toUpperCase());
  }
  if (typeof phone === "string" && phone.trim()) {
    updates.push("phone = ?");
    values.push(phone.trim());
  }
  const nextCity = typeof city === "string" && city.trim() ? city.trim() : donor.city;
  const nextArea = typeof area === "string" && area.trim() ? area.trim() : donor.area;
  if (typeof city === "string" && city.trim()) {
    updates.push("city = ?");
    values.push(nextCity);
  }
  if (typeof area === "string" && area.trim()) {
    updates.push("area = ?");
    values.push(nextArea);
  }
  if (city !== undefined || area !== undefined) {
    const coords = resolveCoordinates(nextCity, nextArea);
    updates.push("latitude = ?", "longitude = ?");
    values.push(coords.lat, coords.lng);
  }
  if (
    availability === "available" ||
    availability === "unavailable" ||
    availability === "recently_donated"
  ) {
    updates.push("availability = ?");
    values.push(availability);
  }
  if (typeof lastDonationDate === "string") {
    updates.push("last_donation_date = ?");
    values.push(lastDonationDate.trim());
  }
  if (typeof consentShareContact === "boolean") {
    updates.push("consent_share_contact = ?");
    values.push(consentShareContact ? 1 : 0);
  }
  if (typeof consentWhatsapp === "boolean") {
    updates.push("consent_whatsapp = ?");
    values.push(consentWhatsapp ? 1 : 0);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: "No valid fields to update." });
    return;
  }

  updates.push("updated_at = datetime('now')");
  values.push(donor.id);

  db.prepare(`UPDATE donors SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  const updated = db.prepare("SELECT * FROM donors WHERE id = ?").get(donor.id);
  res.json({ donor: updated });
});

// Log Donation History
app.post("/api/donors/donations", requireAuth, (req: AuthedRequest, res) => {
  const donor = db
    .prepare("SELECT id FROM donors WHERE user_id = ?")
    .get(req.user!.id) as { id: number } | undefined;

  if (!donor) {
    res.status(404).json({ error: "Donor profile not found." });
    return;
  }

  const { donationDate, hospitalName, city, units, notes } = req.body as {
    donationDate?: string;
    hospitalName?: string;
    city?: string;
    units?: number;
    notes?: string;
  };

  if (!donationDate || !hospitalName?.trim() || !city?.trim()) {
    res.status(400).json({ error: "Donation date, hospital name, and city are required." });
    return;
  }

  const info = db
    .prepare(
      `INSERT INTO donation_history (donor_id, donation_date, hospital_name, city, units, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      donor.id,
      donationDate.trim(),
      hospitalName.trim(),
      city.trim(),
      Math.max(1, Number(units || 1)),
      (notes || "").trim()
    );

  db.prepare(
    `UPDATE donors SET last_donation_date = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(donationDate.trim(), donor.id);

  const record = db
    .prepare("SELECT * FROM donation_history WHERE id = ?")
    .get(Number(info.lastInsertRowid));
  res.status(201).json({ record });
});

// Contact Donor (Consent-enforced)
app.post("/api/donors/:id/contact", (req: AuthedRequest, res) => {
  const donorId = Number(req.params.id);
  const { requesterName, requesterPhone, message } = req.body as {
    requesterName?: string;
    requesterPhone?: string;
    message?: string;
  };

  if (!requesterName?.trim() || !requesterPhone?.trim()) {
    res.status(400).json({ error: "Your name and phone number are required to contact a donor." });
    return;
  }

  const donor = db
    .prepare("SELECT * FROM donors WHERE id = ? AND suspended = 0")
    .get(donorId) as
    | {
        id: number;
        full_name: string;
        phone: string;
        consent_share_contact: number;
        consent_whatsapp: number;
      }
    | undefined;

  if (!donor) {
    res.status(404).json({ error: "Donor not found." });
    return;
  }

  const consentShared = Boolean(donor.consent_share_contact);
  const status = consentShared ? "shared" : "pending";

  db.prepare(
    `INSERT INTO contact_requests (donor_id, requester_user_id, requester_name, requester_phone, message, status)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    donorId,
    req.user?.id ?? null,
    requesterName.trim(),
    requesterPhone.trim(),
    (message || "").trim(),
    status
  );

  res.status(201).json({
    consentShared,
    donorName: donor.full_name,
    phone: consentShared ? donor.phone : null,
    whatsappUrl:
      consentShared && donor.consent_whatsapp
        ? `https://wa.me/${donor.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
            `Hello ${donor.full_name}, contacting via BloodConnect regarding blood donation: ${message || "Urgent blood requirement"}`
          )}`
        : null,
    message: consentShared
      ? "Contact request logged. Donor has consented to share their contact details."
      : "Contact request sent to donor's dashboard. Direct phone is protected until donor approves.",
  });
});

// Respond to a contact request from Donor Dashboard
app.patch("/api/contact-requests/:id", requireAuth, (req: AuthedRequest, res) => {
  const crId = Number(req.params.id);
  const { status } = req.body as { status?: string };
  if (status !== "shared" && status !== "declined") {
    res.status(400).json({ error: "Status must be 'shared' or 'declined'." });
    return;
  }

  const donor = db
    .prepare("SELECT id FROM donors WHERE user_id = ?")
    .get(req.user!.id) as { id: number } | undefined;

  if (!donor) {
    res.status(403).json({ error: "Only registered donors can update contact requests." });
    return;
  }

  db.prepare(
    "UPDATE contact_requests SET status = ? WHERE id = ? AND donor_id = ?"
  ).run(status, crId, donor.id);

  res.json({ ok: true });
});

// List Blood Requests (public open feed or user's own requests)
app.get("/api/requests", (req: AuthedRequest, res) => {
  const mineOnly = String(req.query.mine || "false") === "true";

  if (mineOnly) {
    if (!req.user) {
      res.status(401).json({ error: "Sign in to view your requests." });
      return;
    }
    const rows = db
      .prepare(
        `SELECT * FROM blood_requests WHERE requester_user_id = ? ORDER BY id DESC`
      )
      .all(req.user.id) as Array<{
      id: number;
      blood_group: string;
      city: string;
      area: string;
    }>;

    const enriched = rows.map((r) => {
      const responses = db
        .prepare(
          `SELECT id, donor_id, donor_name, donor_blood_group, donor_city, donor_area,
                  CASE WHEN consent_share_contact = 1 THEN donor_phone ELSE NULL END AS donor_phone,
                  consent_share_contact, message, status, created_at
           FROM request_responses WHERE request_id = ? ORDER BY id DESC`
        )
        .all(r.id);

      const searchCoords = resolveCoordinates(r.city, r.area);
      const matchingRaw = db
        .prepare(
          `SELECT id, full_name, age, blood_group, phone, city, area, latitude, longitude,
                  availability, last_donation_date, consent_share_contact, consent_whatsapp, verified
           FROM donors
           WHERE suspended = 0 AND availability = 'available'
             AND UPPER(blood_group) = UPPER(?) AND LOWER(city) LIKE ?`
        )
        .all(r.blood_group, `%${r.city.toLowerCase()}%`) as Array<{
        id: number;
        full_name: string;
        age: number;
        blood_group: string;
        phone: string;
        city: string;
        area: string;
        latitude: number | null;
        longitude: number | null;
        availability: string;
        last_donation_date: string;
        consent_share_contact: number;
        consent_whatsapp: number;
        verified: number;
      }>;

      const matchingDonors = matchingRaw
        .map((d) => formatPublicDonor(d, searchCoords, r.area))
        .sort((a, b) => a.proximityRank - b.proximityRank)
        .map(({ proximityRank: _p, ...rest }) => rest);

      return { ...r, responses, matchingDonors };
    });

    res.json({ requests: enriched });
    return;
  }

  const rows = db
    .prepare(
      `SELECT br.*,
              (SELECT COUNT(*) FROM request_responses rr WHERE rr.request_id = br.id) AS response_count
       FROM blood_requests br
       WHERE br.status IN ('open', 'responded')
       ORDER BY CASE WHEN br.urgency = 'emergency' THEN 0 ELSE 1 END, br.id DESC
       LIMIT 30`
    )
    .all();

  res.json({ requests: rows });
});

// Track request by code
app.get("/api/requests/track/:code", (req, res) => {
  const code = req.params.code.trim().toUpperCase();
  const row = db
    .prepare("SELECT * FROM blood_requests WHERE UPPER(tracking_code) = ?")
    .get(code) as { id: number } | undefined;

  if (!row) {
    res.status(404).json({ error: "No blood request found with that tracking code." });
    return;
  }

  const responses = db
    .prepare(
      `SELECT id, donor_name, donor_blood_group, donor_city, donor_area,
              CASE WHEN consent_share_contact = 1 THEN donor_phone ELSE NULL END AS donor_phone,
              consent_share_contact, message, status, created_at
       FROM request_responses WHERE request_id = ? ORDER BY id DESC`
    )
    .all(row.id);

  res.json({ request: row, responses });
});

// Create Blood Request
app.post("/api/requests", (req: AuthedRequest, res) => {
  const {
    patientName,
    bloodGroup,
    hospitalName,
    city,
    area,
    unitsRequired,
    requiredDate,
    contactPhone,
    urgency,
    additionalInfo,
  } = req.body as {
    patientName?: string;
    bloodGroup?: string;
    hospitalName?: string;
    city?: string;
    area?: string;
    unitsRequired?: number | string;
    requiredDate?: string;
    contactPhone?: string;
    urgency?: string;
    additionalInfo?: string;
  };

  if (
    !patientName?.trim() ||
    !bloodGroup?.trim() ||
    !hospitalName?.trim() ||
    !city?.trim() ||
    !area?.trim() ||
    !requiredDate?.trim() ||
    !contactPhone?.trim()
  ) {
    res.status(400).json({
      error:
        "Patient name, blood group, hospital, city, area, required date, and contact number are required.",
    });
    return;
  }

  const bgUpper = bloodGroup.trim().toUpperCase();
  if (!BLOOD_GROUPS.includes(bgUpper as (typeof BLOOD_GROUPS)[number])) {
    res.status(400).json({ error: "Please select a valid blood group." });
    return;
  }

  const units = Math.max(1, Math.min(20, Number(unitsRequired || 1)));
  const validUrgency = urgency === "emergency" ? "emergency" : "normal";
  const coords = resolveCoordinates(city, area);
  const trackingCode = `BC-${Math.floor(1000 + Math.random() * 9000)}`;

  const info = db
    .prepare(
      `INSERT INTO blood_requests (
        requester_user_id, patient_name, blood_group, hospital_name,
        city, area, latitude, longitude, units_required, required_date,
        contact_phone, urgency, additional_info, status, tracking_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`
    )
    .run(
      req.user?.id ?? null,
      patientName.trim(),
      bgUpper,
      hospitalName.trim(),
      city.trim(),
      area.trim(),
      coords.lat,
      coords.lng,
      units,
      requiredDate.trim(),
      contactPhone.trim(),
      validUrgency,
      (additionalInfo || "").trim(),
      trackingCode
    );

  const created = db
    .prepare("SELECT * FROM blood_requests WHERE id = ?")
    .get(Number(info.lastInsertRowid));

  // Find matching available donors immediately
  const matchingRaw = db
    .prepare(
      `SELECT id, full_name, age, blood_group, phone, city, area,
              latitude, longitude, availability, last_donation_date,
              consent_share_contact, consent_whatsapp, verified
       FROM donors
       WHERE suspended = 0 AND availability = 'available'
         AND UPPER(blood_group) = ? AND LOWER(city) LIKE ?`
    )
    .all(bgUpper, `%${city.trim().toLowerCase()}%`) as Array<{
    id: number;
    full_name: string;
    age: number;
    blood_group: string;
    phone: string;
    city: string;
    area: string;
    latitude: number | null;
    longitude: number | null;
    availability: string;
    last_donation_date: string;
    consent_share_contact: number;
    consent_whatsapp: number;
    verified: number;
  }>;

  const matchingDonors = matchingRaw
    .map((d) => formatPublicDonor(d, coords, area))
    .sort((a, b) => a.proximityRank - b.proximityRank)
    .map(({ proximityRank: _p, ...rest }) => rest);

  res.status(201).json({
    request: created,
    matchingDonors,
    message: "Blood request posted successfully.",
  });
});

// Donor voluntarily responds to a blood request
app.post("/api/requests/:id/respond", requireAuth, (req: AuthedRequest, res) => {
  const requestId = Number(req.params.id);
  const { message, shareContactConsent } = req.body as {
    message?: string;
    shareContactConsent?: boolean;
  };

  const bloodReq = db
    .prepare("SELECT * FROM blood_requests WHERE id = ?")
    .get(requestId) as { id: number; status: string } | undefined;

  if (!bloodReq) {
    res.status(404).json({ error: "Blood request not found." });
    return;
  }

  const donor = db
    .prepare("SELECT * FROM donors WHERE user_id = ?")
    .get(req.user!.id) as
    | {
        id: number;
        full_name: string;
        blood_group: string;
        city: string;
        area: string;
        phone: string;
        consent_share_contact: number;
      }
    | undefined;

  if (!donor) {
    res.status(400).json({
      error: "Please complete your Donor Registration profile before responding to requests.",
    });
    return;
  }

  const already = db
    .prepare(
      "SELECT id FROM request_responses WHERE request_id = ? AND donor_id = ?"
    )
    .get(requestId, donor.id);

  if (already) {
    res.status(409).json({ error: "You have already responded to this request." });
    return;
  }

  const consentFlag =
    typeof shareContactConsent === "boolean"
      ? shareContactConsent
        ? 1
        : 0
      : donor.consent_share_contact;

  db.prepare(
    `INSERT INTO request_responses (
      request_id, donor_id, donor_user_id, donor_name, donor_blood_group,
      donor_city, donor_area, donor_phone, consent_share_contact, message, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'offered')`
  ).run(
    requestId,
    donor.id,
    req.user!.id,
    donor.full_name,
    donor.blood_group,
    donor.city,
    donor.area,
    donor.phone,
    consentFlag,
    (message || "I am available and willing to donate.").trim()
  );

  if (bloodReq.status === "open") {
    db.prepare("UPDATE blood_requests SET status = 'responded' WHERE id = ?").run(
      requestId
    );
  }

  res.status(201).json({
    ok: true,
    message: "Your offer to donate has been sent to the requester.",
  });
});

// Update Request Status (Requester or Admin)
app.patch("/api/requests/:id/status", requireAuth, (req: AuthedRequest, res) => {
  const reqId = Number(req.params.id);
  const { status } = req.body as { status?: string };

  if (
    status !== "open" &&
    status !== "responded" &&
    status !== "fulfilled" &&
    status !== "cancelled"
  ) {
    res.status(400).json({ error: "Invalid request status." });
    return;
  }

  const existing = db
    .prepare("SELECT requester_user_id FROM blood_requests WHERE id = ?")
    .get(reqId) as { requester_user_id: number | null } | undefined;

  if (!existing) {
    res.status(404).json({ error: "Blood request not found." });
    return;
  }

  if (
    req.user!.role !== "admin" &&
    existing.requester_user_id !== req.user!.id
  ) {
    res.status(403).json({ error: "You can only update your own requests." });
    return;
  }

  db.prepare("UPDATE blood_requests SET status = ? WHERE id = ?").run(status, reqId);
  res.json({ ok: true, status });
});

// Report incorrect info / fake profile
app.post("/api/reports", (req: AuthedRequest, res) => {
  const { targetType, targetId, reporterName, reason, details } = req.body as {
    targetType?: string;
    targetId?: number;
    reporterName?: string;
    reason?: string;
    details?: string;
  };

  if (
    (targetType !== "donor" && targetType !== "request") ||
    !targetId ||
    !reason?.trim()
  ) {
    res.status(400).json({ error: "Target type, ID, and reason are required." });
    return;
  }

  const info = db
    .prepare(
      `INSERT INTO reports (target_type, target_id, reporter_user_id, reporter_name, reason, details)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      targetType,
      Number(targetId),
      req.user?.id ?? null,
      (reporterName || req.user?.fullName || "Anonymous Visitor").trim(),
      reason.trim(),
      (details || "").trim()
    );

  res.status(201).json({
    id: Number(info.lastInsertRowid),
    message: "Thank you. Our admin moderation team will review this report.",
  });
});

// Admin Endpoints
app.get("/api/admin/overview", requireRole(["admin"]), (_req, res) => {
  const totalUsers = (
    db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number }
  ).count;
  const totalDonors = (
    db.prepare("SELECT COUNT(*) AS count FROM donors").get() as { count: number }
  ).count;
  const totalRequests = (
    db.prepare("SELECT COUNT(*) AS count FROM blood_requests").get() as { count: number }
  ).count;
  const pendingReports = (
    db
      .prepare("SELECT COUNT(*) AS count FROM reports WHERE status = 'pending'")
      .get() as { count: number }
  ).count;

  const users = db
    .prepare(
      `SELECT id, full_name, email, role, phone, city, area, verified, suspended, created_at
       FROM users ORDER BY id DESC`
    )
    .all();

  const donors = db
    .prepare(`SELECT * FROM donors ORDER BY id DESC`)
    .all();

  const requests = db
    .prepare(`SELECT * FROM blood_requests ORDER BY id DESC`)
    .all();

  const reports = db
    .prepare(`SELECT * FROM reports ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, id DESC`)
    .all();

  res.json({
    metrics: { totalUsers, totalDonors, totalRequests, pendingReports },
    users,
    donors,
    requests,
    reports,
  });
});

app.patch("/api/admin/donors/:id", requireRole(["admin"]), (req, res) => {
  const id = Number(req.params.id);
  const { verified, suspended, availability } = req.body as {
    verified?: boolean;
    suspended?: boolean;
    availability?: string;
  };

  if (typeof verified === "boolean") {
    db.prepare("UPDATE donors SET verified = ? WHERE id = ?").run(verified ? 1 : 0, id);
  }
  if (typeof suspended === "boolean") {
    db.prepare("UPDATE donors SET suspended = ? WHERE id = ?").run(suspended ? 1 : 0, id);
  }
  if (
    availability === "available" ||
    availability === "unavailable" ||
    availability === "recently_donated"
  ) {
    db.prepare("UPDATE donors SET availability = ? WHERE id = ?").run(availability, id);
  }

  const updated = db.prepare("SELECT * FROM donors WHERE id = ?").get(id);
  res.json({ donor: updated });
});

app.patch("/api/admin/users/:id", requireRole(["admin"]), (req, res) => {
  const id = Number(req.params.id);
  const { verified, suspended } = req.body as {
    verified?: boolean;
    suspended?: boolean;
  };

  if (typeof verified === "boolean") {
    db.prepare("UPDATE users SET verified = ? WHERE id = ?").run(verified ? 1 : 0, id);
    db.prepare("UPDATE donors SET verified = ? WHERE user_id = ?").run(verified ? 1 : 0, id);
  }
  if (typeof suspended === "boolean") {
    db.prepare("UPDATE users SET suspended = ? WHERE id = ?").run(suspended ? 1 : 0, id);
    db.prepare("UPDATE donors SET suspended = ? WHERE user_id = ?").run(suspended ? 1 : 0, id);
  }

  res.json({ ok: true });
});

app.delete("/api/admin/requests/:id", requireRole(["admin"]), (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM blood_requests WHERE id = ?").run(id);
  res.json({ ok: true });
});

app.patch("/api/admin/reports/:id", requireRole(["admin"]), (req, res) => {
  const id = Number(req.params.id);
  const { status, adminNotes } = req.body as { status?: string; adminNotes?: string };
  if (status !== "pending" && status !== "resolved" && status !== "dismissed") {
    res.status(400).json({ error: "Invalid report status." });
    return;
  }
  db.prepare("UPDATE reports SET status = ?, admin_notes = ? WHERE id = ?").run(
    status,
    (adminNotes || "").trim(),
    id
  );
  res.json({ ok: true });
});

// BloodConnect AI Assistant Endpoint
app.post("/api/ai/chat", async (req: AuthedRequest, res) => {
  try {
    const { message, history, uiLanguage } = req.body as {
      message?: string;
      history?: Array<{ role: "user" | "model"; text: string }>;
      uiLanguage?: string;
    };

    if (!message || !message.trim()) {
      res.status(400).json({ error: "Please enter a message for BloodConnect AI." });
      return;
    }

    const result = await runBloodConnectAi({
      message: message.trim(),
      history: Array.isArray(history) ? history : [],
      uiLanguage: uiLanguage || "en",
      currentUser: req.user
        ? { id: req.user.id, fullName: req.user.fullName, role: req.user.role }
        : null,
    });

    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI assistant error.";
    console.error("BloodConnect AI error:", err);
    res.status(500).json({
      error: `BloodConnect AI could not process your request: ${msg}`,
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(distDir, "index.html"));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`BloodConnect server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
