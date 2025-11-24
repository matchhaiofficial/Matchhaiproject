// src/routes/zones.js
const express = require("express");
const router = express.Router();

// POST /zones/register
router.post("/register", async (req, res) => {
  try {
    const payload = req.body || {};

    console.log(
      "[zones] /register payload:",
      JSON.stringify(payload, null, 2)
    );

    // TODO: validation + DB persistence.
    // For now, just pretend we created a zone + branch and return IDs.
    const mockZoneId = "zone_" + Date.now();
    const branches = Array.isArray(payload.branches) ? payload.branches : [];
    const mockBranchIds =
      branches.length > 0
        ? branches.map((_, idx) => `branch_${Date.now()}_${idx}`)
        : ["branch_" + Date.now()];

    return res.json({
      ok: true,
      zoneId: mockZoneId,
      branchIds: mockBranchIds,
      primaryBranchId: mockBranchIds[0],
    });
  } catch (err) {
    console.error("[zones] /register error:", err);
    return res.status(500).json({
      ok: false,
      message: "Internal error while registering zone",
    });
  }
});

module.exports = router;
