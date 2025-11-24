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
    const mockBranchId = "branch_" + Date.now();

    return res.json({
      ok: true,
      zoneId: mockZoneId,
      branchId: mockBranchId,
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
