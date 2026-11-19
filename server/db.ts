import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

export type UserRole = "donor" | "requester" | "admin";
export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
export type AvailabilityStatus = "available" | "unavailable" | "recently_donated";

export const BLOOD_GROUPS: BloodGroup[] = [
  "O+",
  "O-",
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
];

const dataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "bloodconnect.db");
export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'donor',
      phone TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      area TEXT NOT NULL DEFAULT '',
      verified INTEGER NOT NULL DEFAULT 0,
      suspended INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS donors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE,
      full_name TEXT NOT NULL,
      age INTEGER NOT NULL,
      blood_group TEXT NOT NULL,
      phone TEXT NOT NULL,
      city TEXT NOT NULL,
      area TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      availability TEXT NOT NULL DEFAULT 'available',
      last_donation_date TEXT DEFAULT '',
      consent_share_contact INTEGER NOT NULL DEFAULT 0,
      consent_whatsapp INTEGER NOT NULL DEFAULT 0,
      verified INTEGER NOT NULL DEFAULT 0,
      suspended INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS blood_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_user_id INTEGER,
      patient_name TEXT NOT NULL,
      blood_group TEXT NOT NULL,
      hospital_name TEXT NOT NULL,
      city TEXT NOT NULL,
      area TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      units_required INTEGER NOT NULL DEFAULT 1,
      required_date TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      urgency TEXT NOT NULL DEFAULT 'normal',
      additional_info TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      tracking_code TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (requester_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS request_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      donor_id INTEGER NOT NULL,
      donor_user_id INTEGER,
      donor_name TEXT NOT NULL,
      donor_blood_group TEXT NOT NULL,
      donor_city TEXT NOT NULL,
      donor_area TEXT NOT NULL,
      donor_phone TEXT NOT NULL,
      consent_share_contact INTEGER NOT NULL DEFAULT 0,
      message TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'offered',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (request_id) REFERENCES blood_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (donor_id) REFERENCES donors(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contact_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donor_id INTEGER NOT NULL,
      requester_user_id INTEGER,
      requester_name TEXT NOT NULL,
      requester_phone TEXT NOT NULL,
      message TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (donor_id) REFERENCES donors(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS donation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donor_id INTEGER NOT NULL,
      donation_date TEXT NOT NULL,
      hospital_name TEXT NOT NULL,
      city TEXT NOT NULL,
      units INTEGER NOT NULL DEFAULT 1,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (donor_id) REFERENCES donors(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      reporter_user_id INTEGER,
      reporter_name TEXT NOT NULL,
      reason TEXT NOT NULL,
      details TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      admin_notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  seedInitialData();
}

const LOCATION_COORDS: Record<string, { lat: number; lng: number }> = {
  "chennai": { lat: 13.0827, lng: 80.2707 },
  "chennai|adyar": { lat: 13.0012, lng: 80.2565 },
  "chennai|anna nagar": { lat: 13.0850, lng: 80.2101 },
  "chennai|t. nagar": { lat: 13.0418, lng: 80.2341 },
  "chennai|t nagar": { lat: 13.0418, lng: 80.2341 },
  "chennai|velachery": { lat: 12.9815, lng: 80.2180 },
  "chennai|tambaram": { lat: 12.9249, lng: 80.1000 },
  "chennai|guindy": { lat: 13.0067, lng: 80.2206 },
  "chennai|mylapore": { lat: 13.0368, lng: 80.2676 },
  "chennai|porur": { lat: 13.0382, lng: 80.1565 },
  "chennai|sholinganallur": { lat: 12.9010, lng: 80.2279 },
  "chennai|ambattur": { lat: 13.1143, lng: 80.1548 },
  "chennai|chromepet": { lat: 12.9516, lng: 80.1462 },
  "chennai|royapettah": { lat: 13.0543, lng: 80.2640 },
  "coimbatore": { lat: 11.0168, lng: 76.9558 },
  "coimbatore|rs puram": { lat: 11.0085, lng: 76.9502 },
  "coimbatore|gandhipuram": { lat: 11.0176, lng: 76.9674 },
  "coimbatore|peelamedu": { lat: 11.0247, lng: 77.0028 },
  "madurai": { lat: 9.9252, lng: 78.1198 },
  "madurai|anna nagar": { lat: 9.9235, lng: 78.1449 },
  "madurai|kk nagar": { lat: 9.9390, lng: 78.1442 },
  "bengaluru": { lat: 12.9716, lng: 77.5946 },
  "bangalore": { lat: 12.9716, lng: 77.5946 },
  "bengaluru|indiranagar": { lat: 12.9784, lng: 77.6408 },
  "bengaluru|koramangala": { lat: 12.9352, lng: 77.6245 },
  "bengaluru|whitefield": { lat: 12.9698, lng: 77.7500 },
  "bengaluru|jayanagar": { lat: 12.9308, lng: 77.5838 },
  "mumbai": { lat: 19.0760, lng: 72.8777 },
  "mumbai|bandra": { lat: 19.0596, lng: 72.8295 },
  "mumbai|andheri": { lat: 19.1136, lng: 72.8697 },
  "mumbai|dadar": { lat: 19.0178, lng: 72.8478 },
  "delhi": { lat: 28.6139, lng: 77.2090 },
  "new delhi": { lat: 28.6139, lng: 77.2090 },
  "delhi|saket": { lat: 28.5245, lng: 77.2066 },
  "delhi|rohini": { lat: 28.7041, lng: 77.1025 },
  "hyderabad": { lat: 17.3850, lng: 78.4867 },
  "hyderabad|banjara hills": { lat: 17.4156, lng: 78.4347 },
  "hyderabad|madhapur": { lat: 17.4483, lng: 78.3915 },
};

export function resolveCoordinates(
  city: string,
  area: string
): { lat: number | null; lng: number | null } {
  const normCity = city.trim().toLowerCase();
  const normArea = area.trim().toLowerCase();
  const specific = LOCATION_COORDS[`${normCity}|${normArea}`];
  if (specific) {
    return specific;
  }
  const cityMatch = LOCATION_COORDS[normCity];
  if (cityMatch) {
    return cityMatch;
  }
  return { lat: null, lng: null };
}

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function seedInitialData(): void {
  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get() as {
    count: number;
  };
  if (userCount.count > 0) return;

  const adminHash = bcrypt.hashSync("Admin@123", 10);
  const donorHash = bcrypt.hashSync("Donor@123", 10);
  const requesterHash = bcrypt.hashSync("Requester@123", 10);

  const insertUser = db.prepare(`
    INSERT INTO users (full_name, email, password_hash, role, phone, city, area, verified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const adminRes = insertUser.run(
    "Dr. Meenakshi Sundaram",
    "admin@bloodconnect.org",
    adminHash,
    "admin",
    "+919840010001",
    "Chennai",
    "Mylapore",
    1
  );

  const karthikUserRes = insertUser.run(
    "Karthik Subramanian",
    "karthik@bloodconnect.org",
    donorHash,
    "donor",
    "+919840123456",
    "Chennai",
    "Adyar",
    1
  );

  const priyaUserRes = insertUser.run(
    "Priya Narayanan",
    "priya@bloodconnect.org",
    requesterHash,
    "requester",
    "+919840987654",
    "Chennai",
    "T. Nagar",
    1
  );

  const extraDonors = [
    {
      name: "Karthik Subramanian",
      email: "karthik@bloodconnect.org",
      existingUserId: Number(karthikUserRes.lastInsertRowid),
      age: 28,
      blood: "O+",
      phone: "+919840123456",
      city: "Chennai",
      area: "Adyar",
      availability: "available",
      lastDonation: "2026-06-15",
      consentShare: 1,
      consentWa: 1,
      verified: 1,
    },
    {
      name: "Divya Ramesh",
      email: "divya.r@bloodconnect.org",
      age: 25,
      blood: "O+",
      phone: "+919840234561",
      city: "Chennai",
      area: "Anna Nagar",
      availability: "available",
      lastDonation: "2026-05-10",
      consentShare: 1,
      consentWa: 1,
      verified: 1,
    },
    {
      name: "Arjun Krishnan",
      email: "arjun.k@bloodconnect.org",
      age: 31,
      blood: "O+",
      phone: "+919840345672",
      city: "Chennai",
      area: "Velachery",
      availability: "available",
      lastDonation: "2026-07-02",
      consentShare: 1,
      consentWa: 0,
      verified: 1,
    },
    {
      name: "Sangeetha Balaji",
      email: "sangeetha.b@bloodconnect.org",
      age: 29,
      blood: "O-",
      phone: "+919840456783",
      city: "Chennai",
      area: "Mylapore",
      availability: "available",
      lastDonation: "2026-04-20",
      consentShare: 1,
      consentWa: 1,
      verified: 1,
    },
    {
      name: "Vigneshwaran S",
      email: "vignesh.s@bloodconnect.org",
      age: 27,
      blood: "A+",
      phone: "+919840567894",
      city: "Chennai",
      area: "T. Nagar",
      availability: "available",
      lastDonation: "2026-06-01",
      consentShare: 0,
      consentWa: 0,
      verified: 1,
    },
    {
      name: "Nandhini Rajendran",
      email: "nandhini.r@bloodconnect.org",
      age: 24,
      blood: "A-",
      phone: "+919840678905",
      city: "Chennai",
      area: "Guindy",
      availability: "available",
      lastDonation: "",
      consentShare: 1,
      consentWa: 1,
      verified: 0,
    },
    {
      name: "Praveen Kumar",
      email: "praveen.k@bloodconnect.org",
      age: 34,
      blood: "B+",
      phone: "+919840789016",
      city: "Chennai",
      area: "Tambaram",
      availability: "available",
      lastDonation: "2026-03-18",
      consentShare: 1,
      consentWa: 1,
      verified: 1,
    },
    {
      name: "Harishankar Menon",
      email: "hari.m@bloodconnect.org",
      age: 30,
      blood: "B-",
      phone: "+919840890127",
      city: "Chennai",
      area: "Porur",
      availability: "available",
      lastDonation: "2026-05-25",
      consentShare: 1,
      consentWa: 0,
      verified: 1,
    },
    {
      name: "Lakshmi Priya V",
      email: "lakshmi.v@bloodconnect.org",
      age: 26,
      blood: "AB+",
      phone: "+919841012345",
      city: "Chennai",
      area: "Sholinganallur",
      availability: "available",
      lastDonation: "2026-07-12",
      consentShare: 1,
      consentWa: 1,
      verified: 1,
    },
    {
      name: "Mohammed Farhan",
      email: "farhan.m@bloodconnect.org",
      age: 33,
      blood: "AB-",
      phone: "+919841123456",
      city: "Chennai",
      area: "Royapettah",
      availability: "recently_donated",
      lastDonation: "2026-10-20",
      consentShare: 1,
      consentWa: 1,
      verified: 1,
    },
    {
      name: "Surya Prakash",
      email: "surya.p@bloodconnect.org",
      age: 29,
      blood: "O+",
      phone: "+919842234567",
      city: "Coimbatore",
      area: "RS Puram",
      availability: "available",
      lastDonation: "2026-06-09",
      consentShare: 1,
      consentWa: 1,
      verified: 1,
    },
    {
      name: "Keerthana Devi",
      email: "keerthana.d@bloodconnect.org",
      age: 23,
      blood: "B+",
      phone: "+919842345678",
      city: "Coimbatore",
      area: "Peelamedu",
      availability: "available",
      lastDonation: "",
      consentShare: 1,
      consentWa: 1,
      verified: 0,
    },
    {
      name: "Muthuvel Pandian",
      email: "muthuvel.p@bloodconnect.org",
      age: 36,
      blood: "A+",
      phone: "+919843456789",
      city: "Madurai",
      area: "Anna Nagar",
      availability: "available",
      lastDonation: "2026-04-02",
      consentShare: 1,
      consentWa: 1,
      verified: 1,
    },
    {
      name: "Ananya Rao",
      email: "ananya.rao@bloodconnect.org",
      age: 27,
      blood: "O-",
      phone: "+919845567890",
      city: "Bengaluru",
      area: "Indiranagar",
      availability: "available",
      lastDonation: "2026-05-19",
      consentShare: 1,
      consentWa: 1,
      verified: 1,
    },
    {
      name: "Rohan Deshmukh",
      email: "rohan.d@bloodconnect.org",
      age: 32,
      blood: "A+",
      phone: "+919820678901",
      city: "Mumbai",
      area: "Bandra",
      availability: "available",
      lastDonation: "2026-06-28",
      consentShare: 1,
      consentWa: 1,
      verified: 1,
    },
    {
      name: "Aarav Sharma",
      email: "aarav.s@bloodconnect.org",
      age: 28,
      blood: "B+",
      phone: "+919811789012",
      city: "Delhi",
      area: "Saket",
      availability: "available",
      lastDonation: "2026-07-04",
      consentShare: 1,
      consentWa: 1,
      verified: 1,
    },
  ];

  const insertDonor = db.prepare(`
    INSERT INTO donors (
      user_id, full_name, age, blood_group, phone, city, area,
      latitude, longitude, availability, last_donation_date,
      consent_share_contact, consent_whatsapp, verified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let firstDonorId = 0;

  for (const d of extraDonors) {
    let uid = d.existingUserId;
    if (!uid) {
      const u = insertUser.run(
        d.name,
        d.email,
        donorHash,
        "donor",
        d.phone,
        d.city,
        d.area,
        d.verified
      );
      uid = Number(u.lastInsertRowid);
    }
    const coords = resolveCoordinates(d.city, d.area);
    const res = insertDonor.run(
      uid,
      d.name,
      d.age,
      d.blood,
      d.phone,
      d.city,
      d.area,
      coords.lat,
      coords.lng,
      d.availability,
      d.lastDonation,
      d.consentShare,
      d.consentWa,
      d.verified
    );
    if (!firstDonorId) {
      firstDonorId = Number(res.lastInsertRowid);
    }
  }

  const insertRequest = db.prepare(`
    INSERT INTO blood_requests (
      requester_user_id, patient_name, blood_group, hospital_name,
      city, area, latitude, longitude, units_required, required_date,
      contact_phone, urgency, additional_info, status, tracking_code
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const priyaUid = Number(priyaUserRes.lastInsertRowid);
  const c1 = resolveCoordinates("Chennai", "T. Nagar");
  const req1 = insertRequest.run(
    priyaUid,
    "Raghavan Narayanan",
    "O+",
    "Apollo Specialty Hospital, T. Nagar",
    "Chennai",
    "T. Nagar",
    c1.lat,
    c1.lng,
    2,
    "2026-11-19",
    "+919840987654",
    "emergency",
    "Scheduled cardiac surgery tomorrow morning. Hospital blood bank cross-match desk open 24/7.",
    "responded",
    "BC-1042"
  );

  const c2 = resolveCoordinates("Chennai", "Adyar");
  insertRequest.run(
    priyaUid,
    "Meera Krishnan",
    "A+",
    "Fortis Malar Hospital",
    "Chennai",
    "Adyar",
    c2.lat,
    c2.lng,
    1,
    "2026-11-21",
    "+919840987654",
    "normal",
    "Post-operative anemia support. Please ask for Ward 3B blood bank slip.",
    "open",
    "BC-1043"
  );

  const c3 = resolveCoordinates("Coimbatore", "RS Puram");
  insertRequest.run(
    null,
    "Selvamuthu R",
    "B+",
    "KMCH City Center",
    "Coimbatore",
    "RS Puram",
    c3.lat,
    c3.lng,
    2,
    "2026-11-19",
    "+919842110099",
    "emergency",
    "Urgent trauma unit requirement. Family member available at reception.",
    "open",
    "BC-1044"
  );

  const c4 = resolveCoordinates("Bengaluru", "Indiranagar");
  insertRequest.run(
    null,
    "Kavitha Shetty",
    "O-",
    "Manipal Hospital Old Airport Rd",
    "Bengaluru",
    "Indiranagar",
    c4.lat,
    c4.lng,
    1,
    "2026-11-20",
    "+919845001122",
    "emergency",
    "Rare O- negative unit needed for emergency delivery.",
    "open",
    "BC-1045"
  );

  // Sample donor response for Karthik on req1
  db.prepare(`
    INSERT INTO request_responses (
      request_id, donor_id, donor_user_id, donor_name, donor_blood_group,
      donor_city, donor_area, donor_phone, consent_share_contact, message, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    Number(req1.lastInsertRowid),
    firstDonorId,
    Number(karthikUserRes.lastInsertRowid),
    "Karthik Subramanian",
    "O+",
    "Chennai",
    "Adyar",
    "+919840123456",
    1,
    "I live in Adyar and can reach T. Nagar Apollo by 8:30 AM tomorrow.",
    "offered"
  );

  // Sample contact request for Karthik
  db.prepare(`
    INSERT INTO contact_requests (
      donor_id, requester_user_id, requester_name, requester_phone, message, status
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    firstDonorId,
    priyaUid,
    "Priya Narayanan",
    "+919840987654",
    "Need O+ unit at Apollo T. Nagar for tomorrow morning surgery.",
    "shared"
  );

  // Sample donation history for Karthik
  const insertHistory = db.prepare(`
    INSERT INTO donation_history (donor_id, donation_date, hospital_name, city, units, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertHistory.run(
    firstDonorId,
    "2026-06-15",
    "VHS Voluntary Health Services, Adyar",
    "Chennai",
    1,
    "Routine voluntary whole blood donation."
  );
  insertHistory.run(
    firstDonorId,
    "2025-12-10",
    "Apollo Hospitals Greams Road",
    "Chennai",
    1,
    "Replacement donation for emergency ward."
  );

  // Sample report for Admin dashboard
  db.prepare(`
    INSERT INTO reports (
      target_type, target_id, reporter_user_id, reporter_name, reason, details, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    "donor",
    6,
    Number(adminRes.lastInsertRowid),
    "Community Moderator",
    "Phone verification pending",
    "Donor newly registered; verify availability and city details during routine check.",
    "pending"
  );
}
