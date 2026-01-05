const express = require("express");
const { verifyPsnForTekkenAndFc } = require("../services/psnService");

const router = express.Router();

router.post("/verify", async (req, res) => {
    try {
        const { psnOnlineId, wantsTekken, wantsFc } = req.body;

        if (!psnOnlineId) {
            return res.status(400).send("Missing psnOnlineId");
        }

        if (!wantsTekken && !wantsFc) {
            // Just verify user exists if games aren't selected
            // or we can allow it.
        }

        const data = await verifyPsnForTekkenAndFc(psnOnlineId);

        // Filter out games if user didn't want them? 
        // The prompt says "If Tekken or FC is selected ... verify ... basic PSN stats for Tekken 8 and FC25/26".
        // We return everything found, frontend can choose what to show or save.

        res.json({ ok: true, data });
    } catch (e) {
        console.error("[psnRoute] verify error", e.message);
        res.status(400).json({ ok: false, message: e.message });
    }
});

module.exports = router;
