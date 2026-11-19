import { FunctionDeclaration, GoogleGenAI, Type } from "@google/genai";
import { db, haversineKm, resolveCoordinates } from "./db.ts";

export interface AiChatResult {
  reply: string;
  detectedLanguage: "en" | "tanglish" | "ta" | "hi";
  suggestedNavigation?: {
    page: "find" | "register-donor" | "request-blood" | "dashboard" | "auth";
    label: string;
    filters?: {
      bloodGroup?: string;
      city?: string;
      area?: string;
    };
  };
  matchingDonorsPreview?: Array<{
    id: number;
    fullName: string;
    bloodGroup: string;
    city: string;
    area: string;
    availability: string;
    verified: boolean;
    consentShareContact: boolean;
  }>;
  requestsPreview?: Array<{
    id: number;
    trackingCode: string;
    patientName: string;
    bloodGroup: string;
    hospitalName: string;
    city: string;
    status: string;
    urgency: string;
  }>;
}

const searchDonorsTool: FunctionDeclaration = {
  name: "search_donors",
  description:
    "Search real registered donors in the BloodConnect database by blood group, city, and optional area.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      bloodGroup: {
        type: Type.STRING,
        description: "Blood group such as A+, A-, B+, B-, AB+, AB-, O+, O-. Optional.",
      },
      city: {
        type: Type.STRING,
        description: "City name such as Chennai, Coimbatore, Madurai, Bengaluru, Mumbai, Delhi.",
      },
      area: {
        type: Type.STRING,
        description: "Optional neighborhood or area such as Adyar, Anna Nagar, T. Nagar.",
      },
    },
  },
};

const checkRequestStatusTool: FunctionDeclaration = {
  name: "check_request_status",
  description:
    "Check real blood request status in the database by tracking code (e.g. BC-1042), contact phone, or for the currently logged-in user.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackingCode: {
        type: Type.STRING,
        description: "Optional tracking code like BC-1042.",
      },
      phone: {
        type: Type.STRING,
        description: "Optional requester contact phone.",
      },
    },
  },
};

const getPlatformStatsTool: FunctionDeclaration = {
  name: "get_platform_stats",
  description:
    "Get live BloodConnect platform statistics (total donors, available donors, open requests, cities covered).",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

function executeSearchDonors(args: {
  bloodGroup?: string;
  city?: string;
  area?: string;
}) {
  const bloodGroup = (args.bloodGroup || "").trim().toUpperCase();
  const city = (args.city || "").trim();
  const area = (args.area || "").trim();

  let sql = `
    SELECT id, full_name, blood_group, city, area, latitude, longitude,
           availability, consent_share_contact, consent_whatsapp, verified
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

  const rows = db.prepare(sql).all(...params) as Array<{
    id: number;
    full_name: string;
    blood_group: string;
    city: string;
    area: string;
    latitude: number | null;
    longitude: number | null;
    availability: string;
    consent_share_contact: number;
    consent_whatsapp: number;
    verified: number;
  }>;

  const targetCoords = city ? resolveCoordinates(city, area) : { lat: null, lng: null };
  const areaLower = area.toLowerCase();

  const scored = rows
    .filter((r) => r.availability === "available")
    .map((r) => {
      let score = 1000;
      if (areaLower && r.area.toLowerCase().includes(areaLower)) {
        score = 0;
      } else if (
        targetCoords.lat !== null &&
        targetCoords.lng !== null &&
        r.latitude !== null &&
        r.longitude !== null
      ) {
        score = haversineKm(targetCoords.lat, targetCoords.lng, r.latitude, r.longitude);
      }
      return {
        id: r.id,
        fullName: r.full_name,
        bloodGroup: r.blood_group,
        city: r.city,
        area: r.area,
        availability: r.availability,
        verified: Boolean(r.verified),
        consentShareContact: Boolean(r.consent_share_contact),
        distanceScore: score,
      };
    })
    .sort((a, b) => a.distanceScore - b.distanceScore);

  return {
    totalAvailableMatches: scored.length,
    donors: scored.slice(0, 5).map(({ distanceScore: _d, ...rest }) => rest),
    note: "Do NOT expose phone numbers directly in chat; direct user to the Find Blood Donors page to contact consenting donors safely.",
  };
}

function executeCheckRequestStatus(
  args: { trackingCode?: string; phone?: string },
  currentUserId?: number
) {
  const code = (args.trackingCode || "").trim().toUpperCase();
  const phone = (args.phone || "").trim();

  let rows: Array<{
    id: number;
    tracking_code: string;
    patient_name: string;
    blood_group: string;
    hospital_name: string;
    city: string;
    status: string;
    urgency: string;
    units_required: number;
    required_date: string;
  }> = [];

  if (code) {
    rows = db
      .prepare(
        `SELECT id, tracking_code, patient_name, blood_group, hospital_name, city, status, urgency, units_required, required_date
         FROM blood_requests WHERE UPPER(tracking_code) = ?`
      )
      .all(code) as typeof rows;
  } else if (phone) {
    rows = db
      .prepare(
        `SELECT id, tracking_code, patient_name, blood_group, hospital_name, city, status, urgency, units_required, required_date
         FROM blood_requests WHERE contact_phone LIKE ? ORDER BY id DESC LIMIT 5`
      )
      .all(`%${phone.slice(-6)}%`) as typeof rows;
  } else if (currentUserId) {
    rows = db
      .prepare(
        `SELECT id, tracking_code, patient_name, blood_group, hospital_name, city, status, urgency, units_required, required_date
         FROM blood_requests WHERE requester_user_id = ? ORDER BY id DESC LIMIT 5`
      )
      .all(currentUserId) as typeof rows;
  }

  const enriched = rows.map((r) => {
    const respCount = (
      db
        .prepare("SELECT COUNT(*) AS c FROM request_responses WHERE request_id = ?")
        .get(r.id) as { c: number }
    ).c;
    return {
      id: r.id,
      trackingCode: r.tracking_code,
      patientName: r.patient_name,
      bloodGroup: r.blood_group,
      hospitalName: r.hospital_name,
      city: r.city,
      status: r.status,
      urgency: r.urgency,
      unitsRequired: r.units_required,
      requiredDate: r.required_date,
      donorResponsesCount: respCount,
    };
  });

  return {
    loggedIn: Boolean(currentUserId),
    foundCount: enriched.length,
    requests: enriched,
  };
}

function executeGetPlatformStats() {
  const totalDonors = (
    db.prepare("SELECT COUNT(*) AS c FROM donors WHERE suspended = 0").get() as { c: number }
  ).c;
  const availableDonors = (
    db
      .prepare(
        "SELECT COUNT(*) AS c FROM donors WHERE suspended = 0 AND availability = 'available'"
      )
      .get() as { c: number }
  ).c;
  const totalRequests = (
    db.prepare("SELECT COUNT(*) AS c FROM blood_requests").get() as { c: number }
  ).c;
  const openRequests = (
    db
      .prepare("SELECT COUNT(*) AS c FROM blood_requests WHERE status IN ('open', 'responded')")
      .get() as { c: number }
  ).c;
  return { totalDonors, availableDonors, totalRequests, openRequests };
}

export async function runBloodConnectAi(params: {
  message: string;
  history: Array<{ role: "user" | "model"; text: string }>;
  uiLanguage: string;
  currentUser?: { id: number; fullName: string; role: string } | null;
}): Promise<AiChatResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in server environment.");
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const systemInstruction = `You are BloodConnect AI, the helpful, trustworthy multilingual assistant for the BloodConnect blood donor finder platform.
Tagline: "Find Blood. Connect Donors. Save Lives."

CRITICAL RULES:
1. Language Detection & Response:
   - Automatically detect the language of the user's latest message: English, Tanglish (Tamil written in English/Latin script like "Enakku O+ blood venum Chennai la", "En request status enna?"), Tamil (தமிழ் script), or Hindi (हिन्दी script or Hinglish).
   - Reply in the SAME language the user used (if Tanglish, reply in clear, natural Tanglish; if Tamil, Tamil; if Hindi, Hindi; if English, English).
   - Tolerate spelling mistakes and simple/colloquial sentences. Understand true user intent rather than brittle keywords.
2. Grounded Facts Only:
   - ALWAYS call 'search_donors' when the user asks to find blood or donors in a city/area or for a blood group.
   - ALWAYS call 'check_request_status' when the user asks about their blood request status.
   - NEVER invent donor names, counts, availability, or phone numbers. Only cite real records returned by tools.
   - NEVER expose phone numbers in chat. Tell the user to click the donor's Contact button on the Find Blood page (which enforces donor consent).
   - NEVER claim a donor is confirmed or guaranteed to donate until they respond and confirm.
3. Medical Safety & Emergencies:
   - NEVER provide medical diagnosis, prescribe treatment, or certify medical transfusion compatibility.
   - Always note when relevant that donor matching is not medical compatibility confirmation; hospital blood-bank professionals must verify compatibility and cross-matching.
   - If the user mentions an active medical emergency, severe bleeding, accident, or urgent hospital need, IMMEDIATELY advise contacting local emergency services (108 / 112) or going straight to the nearest hospital blood bank, while also helping them search donors or submit an Emergency Blood Request.
4. Guidance & Navigation:
   - Guide beginners clearly step by step on how to use:
     * Find Blood page (select blood group, city, area, click Search Donors)
     * Donor Registration page (fill name, age 18+, blood group, phone, city, area, consent)
     * Blood Request page (submit patient/hospital details to notify donors)
     * Dashboard (Donor / Requester / Admin)
   - Keep answers concise, warm, clear, and beginner-friendly.

Current UI language preference: ${params.uiLanguage}
Current user session: ${
    params.currentUser
      ? `Signed in as ${params.currentUser.fullName} (role: ${params.currentUser.role}, id: ${params.currentUser.id})`
      : "Not signed in (Guest)"
  }`;

  const contents = [
    ...params.history.slice(-8).map((h) => ({
      role: h.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: h.text }],
    })),
    { role: "user" as const, parts: [{ text: params.message }] },
  ];

  const toolCtx: {
    searchResult: ReturnType<typeof executeSearchDonors> | null;
    searchArgs: { bloodGroup?: string; city?: string; area?: string } | null;
    requestResult: ReturnType<typeof executeCheckRequestStatus> | null;
  } = {
    searchResult: null,
    searchArgs: null,
    requestResult: null,
  };

  const response1 = await ai.models.generateContent({
    model: "gemini-4-hydrogen",
    contents,
    config: {
      systemInstruction,
      tools: [
        {
          functionDeclarations: [
            searchDonorsTool,
            checkRequestStatusTool,
            getPlatformStatsTool,
          ],
        },
      ],
    },
  });

  let finalText = response1.text ?? "";
  const firstCandidateContent = response1.candidates?.[0]?.content;
  const functionCalls = response1.functionCalls;

  if (functionCalls && functionCalls.length > 0 && firstCandidateContent) {
    const toolResponseParts = functionCalls.map((fc) => {
      const args = (fc.args || {}) as Record<string, string>;
      let result: unknown = {};
      if (fc.name === "search_donors") {
        const res = executeSearchDonors(args);
        toolCtx.searchArgs = args;
        toolCtx.searchResult = res;
        result = res;
      } else if (fc.name === "check_request_status") {
        const res = executeCheckRequestStatus(args, params.currentUser?.id);
        toolCtx.requestResult = res;
        result = res;
      } else if (fc.name === "get_platform_stats") {
        result = executeGetPlatformStats();
      }
      return {
        functionResponse: {
          id: fc.id,
          name: fc.name,
          response: { result },
        },
      };
    });

    const response2 = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: [
        ...contents,
        firstCandidateContent,
        {
          role: "user",
          parts: toolResponseParts,
        },
      ],
      config: {
        systemInstruction,
        tools: [
          {
            functionDeclarations: [
              searchDonorsTool,
              checkRequestStatusTool,
              getPlatformStatsTool,
            ],
          },
        ],
      },
    });

    finalText = response2.text ?? finalText;
  }

  // Heuristic language tag for UI metadata
  const msgLower = params.message.toLowerCase();
  let detectedLanguage: AiChatResult["detectedLanguage"] = "en";
  if (/[\u0B80-\u0BFF]/.test(params.message)) {
    detectedLanguage = "ta";
  } else if (/[\u0900-\u097F]/.test(params.message)) {
    detectedLanguage = "hi";
  } else if (
    /\b(enakku|venum|enna|epdi|irukka|la|iruku|pannanum|thevai|pannu|enga|inga|sollu)\b/.test(
      msgLower
    )
  ) {
    detectedLanguage = "tanglish";
  }

  // Determine helpful suggested navigation CTA based on real intent/tool calls
  let suggestedNavigation: AiChatResult["suggestedNavigation"] | undefined;

  if (toolCtx.searchArgs) {
    suggestedNavigation = {
      page: "find",
      label: `Open Find Blood${toolCtx.searchArgs.bloodGroup ? ` (${toolCtx.searchArgs.bloodGroup})` : ""}`,
      filters: {
        bloodGroup: toolCtx.searchArgs.bloodGroup,
        city: toolCtx.searchArgs.city,
        area: toolCtx.searchArgs.area,
      },
    };
  } else if (toolCtx.requestResult) {
    suggestedNavigation = params.currentUser
      ? { page: "dashboard", label: "Open My Dashboard" }
      : { page: "auth", label: "Sign In to View Requests" };
  } else if (
    /\b(become a donor|register as donor|donate blood|donor aaganum|donor register|ரத்த தானம்|रक्तदान)\b/i.test(
      params.message
    )
  ) {
    suggestedNavigation = {
      page: "register-donor",
      label: "Go to Donor Registration",
    };
  } else if (
    /\b(request blood|need urgent blood|emergency|hospital|ரத்தம் தேவை|रक्त चाहिए)\b/i.test(
      params.message
    )
  ) {
    suggestedNavigation = {
      page: "request-blood",
      label: "Post a Blood Request",
    };
  }

  return {
    reply:
      finalText.trim() ||
      "I am here to help you find donors, register as a donor, or check blood request status.",
    detectedLanguage,
    suggestedNavigation,
    matchingDonorsPreview: toolCtx.searchResult?.donors,
    requestsPreview: toolCtx.requestResult?.requests,
  };
}
