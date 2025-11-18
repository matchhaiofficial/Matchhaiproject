// src/routes/steam.js
const express = require("express");
const axios = require("axios");

const router = express.Router();

const { STEAM_API_KEY } = process.env;

function extractSteamIdOrVanity(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) return null;

  // pure digits → steamID64
  if (/^\d+$/.test(trimmed)) {
    return { type: "id", value: trimmed };
  }

  // URL case
  try {
    const url = new URL(trimmed);

    if (url.hostname.includes("steamcommunity.com")) {
      const parts = url.pathname.split("/").filter(Boolean); // remove empty

      // /profiles/7656119...
      if (parts[0] === "profiles" && parts[1]) {
        return { type: "id", value: parts[1] };
      }

      // /id/YourName
      if (parts[0] === "id" && parts[1]) {
        return { type: "vanity", value: parts[1] };
      }
    }
  } catch (e) {
    // not a URL, ignore
  }

  // fallback: treat as vanity string
  return { type: "vanity", value: trimmed };
}

router.get("/profile-from-url", async (req, res) => {
  try {
    if (!STEAM_API_KEY) {
      return res
        .status(500)
        .send("STEAM_API_KEY is not set on the backend.");
    }

    const inputUrl = req.query.url;
    if (!inputUrl || typeof inputUrl !== "string") {
      return res.status(400).send("Missing ?url parameter.");
    }

    const parsed = extractSteamIdOrVanity(inputUrl);
    if (!parsed) {
      return res.status(400).send("Could not parse Steam URL or ID.");
    }

    let steamId = parsed.value;

    // Resolve vanity if needed
    if (parsed.type === "vanity") {
      const vanityEndpoint =
        "https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/";
      const vanityParams = {
        key: STEAM_API_KEY,
        vanityurl: parsed.value,
      };

      console.log(
        "[steam] Calling ResolveVanityURL with",
        JSON.stringify(vanityParams)
      );

      const vanityRes = await axios.get(vanityEndpoint, {
        params: vanityParams,
      });
      const body = vanityRes.data;

      if (
        !body ||
        !body.response ||
        body.response.success !== 1 ||
        !body.response.steamid
      ) {
        console.log("[steam] vanity resolve failed:", body);
        return res
          .status(400)
          .send(
            "Could not resolve this Steam vanity URL. Please paste a direct profile link instead."
          );
      }

      steamId = body.response.steamid;
    }

    // Get basic profile info
    const summariesEndpoint =
      "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/";
    const summariesParams = {
      key: STEAM_API_KEY,
      steamids: steamId,
    };

    console.log(
      "[steam] Calling GetPlayerSummaries with",
      JSON.stringify(summariesParams)
    );

    const summariesRes = await axios.get(summariesEndpoint, {
      params: summariesParams,
    });
    const summaries = summariesRes.data;

    const players = summaries?.response?.players;
    if (!players || !players.length) {
      return res.status(404).send("No Steam player found for this link.");
    }

    const p = players[0];

    const result = {
      steamId: p.steamid,
      personaName: p.personaname,
      avatarUrl: p.avatarfull || p.avatar,
      countryCode: p.loccountrycode || null,
      cs2Hours: null, // optional: add GetOwnedGames call later
    };

    return res.json(result);
  } catch (err) {
    console.error("[steam] error in /profile-from-url:", err.message);
    return res
      .status(500)
      .send("Steam lookup failed. Please try again later.");
  }
});

module.exports = router;
