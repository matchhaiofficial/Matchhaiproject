// src/routes/requests.js
const express = require("express");
const router = express.Router();

const zoneCatalog = [
  {
    id: "zone_o2",
    name: "O2",
    area: "Federal B Area",
    sports: ["cs2", "fc25", "tekken8"],
    basePrice: 450,
    amenities: ["PC pods", "Fast internet"],
  },
  {
    id: "zone_nuketown",
    name: "Nuke Town",
    area: "Tariq Road",
    sports: ["cs2", "fc25"],
    basePrice: 500,
    amenities: ["PC pods", "Snacks"],
  },
  {
    id: "zone_velocity",
    name: "Velocity",
    area: "Defence",
    sports: ["cs2", "tekken8"],
    basePrice: 520,
    amenities: ["Bootcamps", "Cafe"],
  },
  {
    id: "zone_blazearena",
    name: "BlazeArena",
    area: "Defence",
    sports: ["padel", "pickleball"],
    basePrice: 900,
    amenities: ["Locker rooms", "Racquet rentals"],
  },
  {
    id: "zone_maidan",
    name: "Maidan",
    area: "Gulshan",
    sports: ["futsal"],
    basePrice: 700,
    amenities: ["LED lighting", "Changing rooms"],
  },
];

const activeRequests = new Map();

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map((v) => (v || "").toString().trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function toPartyLabel(partyType) {
  switch (partyType) {
    case "duo":
      return "Duo booking";
    case "trio":
      return "Trio booking";
    case "quad":
      return "Quad booking";
    case "team":
      return "Team booking";
    default:
      return "Solo booking";
  }
}

function buildOffers(payload, requestId) {
  const preferredAreas = normalizeList(payload.preferredAreas);
  const preferredZones = normalizeList(payload.preferredZones);

  const filteredZones = zoneCatalog.filter((zone) => {
    const areaMatch =
      preferredAreas.length === 0 || preferredAreas.includes(zone.area);
    const zoneMatch =
      preferredZones.length === 0 || preferredZones.includes(zone.name);
    const sportMatch = zone.sports.includes(payload.sport);
    return areaMatch && zoneMatch && sportMatch;
  });

  const source = filteredZones.length > 0 ? filteredZones : zoneCatalog;

  return source.map((zone, idx) => {
    const price = zone.basePrice + idx * 25;
    return {
      id: `offer_${requestId}_${idx}`,
      requestId,
      zoneId: zone.id,
      zoneName: zone.name,
      areaLabel: zone.area,
      sport: payload.sport,
      time: payload.timePreference,
      pricePerPlayer: price,
      currency: "PKR",
      slotsSummary: toPartyLabel(payload.partyType),
      responseEtaMinutes: 4 + idx * 3,
      message:
        payload.notes && payload.notes.trim().length > 0
          ? `${zone.name} can host. ${payload.notes.trim()}`
          : `${zone.name} can host this slot.`,
      status: "pending",
      amenities: zone.amenities,
    };
  });
}

// POST /requests – create a broadcast request and fan out to eligible zones
router.post("/", async (req, res) => {
  try {
    const payload = req.body || {};
    const requestId = `req_${Date.now()}`;

    const normalizedPayload = {
      sport: payload.sport || "cs2",
      timePreference: payload.timePreference || payload.time || "", // allow legacy "time"
      partyType: payload.partyType || "solo",
      preferredAreas: normalizeList(payload.preferredAreas),
      preferredZones: normalizeList(payload.preferredZones),
      notes: payload.notes || "",
      userId: payload.userId,
      userName: payload.userName,
      email: payload.email,
    };

    if (!normalizedPayload.timePreference) {
      return res.status(400).json({
        ok: false,
        message: "timePreference is required to create a booking request",
      });
    }

    const offers = buildOffers(normalizedPayload, requestId);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    activeRequests.set(requestId, {
      requestId,
      payload: normalizedPayload,
      offers,
      expiresAt,
      status: "pending",
      selectedOfferId: null,
    });

    return res.json({ ok: true, requestId, offers, expiresAt });
  } catch (err) {
    console.error("[requests] create error", err);
    return res.status(500).json({
      ok: false,
      message: "Internal error while creating booking request",
    });
  }
});

// GET /requests/:id/offers – return current offers (or regenerate if missing)
router.get("/:id/offers", async (req, res) => {
  try {
    const { id } = req.params;
    const existing = activeRequests.get(id);

    if (!existing) {
      return res.status(404).json({ ok: false, message: "Request not found" });
    }

    // If offers somehow empty, rebuild from payload
    const offers =
      existing.offers && existing.offers.length > 0
        ? existing.offers
        : buildOffers(existing.payload, id);

    activeRequests.set(id, { ...existing, offers });

    return res.json({ ok: true, offers, expiresAt: existing.expiresAt });
  } catch (err) {
    console.error("[requests] offers fetch error", err);
    return res.status(500).json({
      ok: false,
      message: "Internal error while fetching offers",
    });
  }
});

// POST /requests/:id/offers/:offerId/accept – mark an offer as accepted
router.post("/:id/offers/:offerId/accept", async (req, res) => {
  try {
    const { id, offerId } = req.params;
    const existing = activeRequests.get(id);

    if (!existing) {
      return res.status(404).json({ ok: false, message: "Request not found" });
    }

    const offers = existing.offers || [];
    const offerIndex = offers.findIndex((o) => o.id === offerId);

    if (offerIndex === -1) {
      return res.status(404).json({ ok: false, message: "Offer not found" });
    }

    const updatedOffers = offers.map((offer, idx) => ({
      ...offer,
      status: idx === offerIndex ? "accepted" : "declined",
    }));

    const selected = updatedOffers[offerIndex];

    activeRequests.set(id, {
      ...existing,
      offers: updatedOffers,
      status: "accepted",
      selectedOfferId: selected.id,
    });

    return res.json({ ok: true, offer: selected });
  } catch (err) {
    console.error("[requests] accept error", err);
    return res.status(500).json({
      ok: false,
      message: "Internal error while accepting offer",
    });
  }
});

module.exports = router;
