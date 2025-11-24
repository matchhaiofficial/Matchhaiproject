// src/routes/requests.js
const express = require("express");
const router = express.Router();

// Extremely lightweight in-memory store for demo purposes
const requests = new Map();
const offers = new Map(); // key: requestId -> array of offers

function nowTs() {
  return Date.now();
}

function ensureRequest(id) {
  const req = requests.get(id);
  if (!req) return null;

  if (req.expiresAt && nowTs() > req.expiresAt && req.status !== "expired") {
    req.status = "expired";
  }
  return req;
}

router.post("/", (req, res) => {
  try {
    const payload = req.body || {};
    const id = "req_" + nowTs();
    const expiresInMs = payload.expiresInMs || 30 * 60 * 1000; // default 30m

    const record = {
      id,
      sport: payload.sport || "unknown",
      timeWindow: payload.timeWindow || "ASAP",
      partyType: payload.partyType || "solo",
      preferredAreas: Array.isArray(payload.preferredAreas)
        ? payload.preferredAreas
        : payload.preferredAreas
        ? [payload.preferredAreas]
        : [],
      preferredZones: Array.isArray(payload.preferredZones)
        ? payload.preferredZones
        : payload.preferredZones
        ? [payload.preferredZones]
        : [],
      requester: payload.requester || {},
      status: "pending",
      createdAt: nowTs(),
      expiresAt: nowTs() + expiresInMs,
      offerState: "offers-pending",
    };

    requests.set(id, record);
    offers.set(id, []);

    const notifiedZones = [
      ...record.preferredZones,
      ...record.preferredAreas.map((area) => `${area}-any-zone`),
    ];

    return res.json({ ok: true, request: record, notifiedZones });
  } catch (err) {
    console.error("[requests] create error", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to create booking request" });
  }
});

router.get("/:id", (req, res) => {
  try {
    const record = ensureRequest(req.params.id);
    if (!record) {
      return res.status(404).json({ ok: false, message: "Request not found" });
    }

    return res.json({
      ok: true,
      request: record,
      offers: offers.get(record.id) || [],
    });
  } catch (err) {
    console.error("[requests] fetch error", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to load request" });
  }
});

router.post("/:id/offers", (req, res) => {
  try {
    const record = ensureRequest(req.params.id);
    if (!record) {
      return res.status(404).json({ ok: false, message: "Request not found" });
    }

    if (record.status === "expired") {
      return res
        .status(400)
        .json({ ok: false, message: "Request has expired" });
    }

    const list = offers.get(record.id) || [];
    const offerId = `offer_${nowTs()}_${list.length}`;
    const offer = {
      id: offerId,
      requestId: record.id,
      zoneId: req.body.zoneId || "unknown-zone",
      zoneName: req.body.zoneName || req.body.zoneId || "Unknown Zone",
      adminContact: req.body.adminContact || "n/a",
      slotTime: req.body.slotTime || record.timeWindow,
      price: req.body.price || 0,
      notes: req.body.notes || "",
      status: "pending",
      createdAt: nowTs(),
    };

    list.push(offer);
    offers.set(record.id, list);
    record.status = "offers-pending";

    return res.json({ ok: true, offer, offers: list });
  } catch (err) {
    console.error("[requests] offer error", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to submit offer" });
  }
});

router.post("/:id/accept", (req, res) => {
  try {
    const record = ensureRequest(req.params.id);
    if (!record) {
      return res.status(404).json({ ok: false, message: "Request not found" });
    }

    const offerId = req.body.offerId;
    const list = offers.get(record.id) || [];

    let found = false;
    list.forEach((offer) => {
      if (offer.id === offerId) {
        offer.status = "accepted";
        found = true;
      } else if (offer.status === "pending") {
        offer.status = "rejected";
      }
    });

    if (!found) {
      return res
        .status(404)
        .json({ ok: false, message: "Offer not found for request" });
    }

    record.status = "offer-accepted";

    return res.json({ ok: true, request: record, offers: list });
  } catch (err) {
    console.error("[requests] accept error", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to accept offer" });
  }
});

router.post("/:id/reject", (req, res) => {
  try {
    const record = ensureRequest(req.params.id);
    if (!record) {
      return res.status(404).json({ ok: false, message: "Request not found" });
    }

    record.status = "offer-rejected";
    return res.json({ ok: true, request: record });
  } catch (err) {
    console.error("[requests] reject error", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to reject offers" });
  }
});

module.exports = router;
