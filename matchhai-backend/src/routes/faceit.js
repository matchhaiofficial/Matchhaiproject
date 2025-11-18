// src/routes/faceit.js
const express = require("express");
const axios = require("axios");
const router = express.Router();

const { FACEIT_API_KEY } = process.env; // use the name you actually have in .env

// GET /faceit/profile-from-value?value=<url-or-nickname>&game=cs2
router.get("/profile-from-value", async (req, res) => {
  const { value, game = "cs2" } = req.query;
  console.log("[FACEIT] /profile-from-value hit:", { value, game });

  if (!FACEIT_API_KEY) {
    return res
      .status(500)
      .send("FACEIT API key not configured on server.");
  }

  if (!value || typeof value !== "string" || !value.trim()) {
    return res.status(400).send("Missing or invalid FACEIT profile value.");
  }

  try {
    let nickname = value.trim();

    // If value looks like a full FACEIT URL, parse nickname from it
    try {
      const maybeUrl = new URL(value.trim());
      if (maybeUrl.hostname.includes("faceit.com")) {
        const parts = maybeUrl.pathname.split("/").filter(Boolean); // e.g. ["en","players","Nickname"]
        const playerIndex = parts.findIndex(
          (p) => p.toLowerCase() === "players"
        );
        if (playerIndex >= 0 && parts[playerIndex + 1]) {
          nickname = parts[playerIndex + 1];
          console.log("[FACEIT] Parsed nickname from URL:", nickname);
        }
      }
    } catch {
      // value may just be a raw nickname
    }

    const url = new URL("https://open.faceit.com/data/v4/players");
    url.searchParams.set("nickname", nickname);
    url.searchParams.set("game", game);

    const resFaceit = await axios.get(url.toString(), {
      headers: {
        Authorization: `Bearer ${FACEIT_API_KEY}`,
      },
    });

    const playerJson = resFaceit.data;
    console.log("[FACEIT] playerJson:", playerJson);

    const gameInfo = playerJson.games?.[game] || {};
    const faceitSummary = {
      faceitId: playerJson.player_id,
      nickname: playerJson.nickname,
      game,
      elo: gameInfo.faceit_elo ?? null,
      skillLevel: gameInfo.skill_level ?? null,
      country: playerJson.country ?? null,
      avatarUrl: playerJson.avatar ?? null,
    };

    return res.json(faceitSummary);
  } catch (err) {
    console.error("[FACEIT] error in /profile-from-value:", err?.response?.data || err);
    return res.status(500).send("FACEIT service error on server.");
  }
});

module.exports = router;
