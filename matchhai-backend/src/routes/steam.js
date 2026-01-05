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
      cs2Hours: null,
      stats: null,
    };

    // 2. Get CS2 Hours (AppID 730)
    try {
      const ownedGamesUrl = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/`;
      const ownedGamesRes = await axios.get(ownedGamesUrl, {
        params: {
          key: STEAM_API_KEY,
          steamid: steamId,
          include_appinfo: true,
          include_played_free_games: true,
        },
      });
      const games = ownedGamesRes.data?.response?.games;
      if (games && games.length > 0) {
        const cs2 = games.find((g) => g.appid === 730);
        if (cs2) {
          result.cs2Hours = Math.round(cs2.playtime_forever / 60);
        }
      }
    } catch (e) {
      console.log("[steam] GetOwnedGames failed:", e.message);
      result.debugHoursError = e.message;
    }

    // 3. Get CS2 Stats (AppID 730)
    try {
      const statsUrl = `https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/`;
      const statsRes = await axios.get(statsUrl, {
        params: {
          key: STEAM_API_KEY,
          steamid: steamId,
          appid: 730,
        },
      });
      const statsData = statsRes.data?.playerstats?.stats;
      if (statsData) {
        // Helper to find stat
        const getStat = (name) => {
          const s = statsData.find((x) => x.name === name);
          return s ? s.value : 0;
        };

        const totalKills = getStat("total_kills");
        const totalDeaths = getStat("total_deaths");
        const totalWins = getStat("total_wins"); // total_matches_won
        const totalDamage = getStat("total_damage_done");

        // headshot kills isn't always directly "total_kills_headshot", checking standard names.
        // Usually it's total_kills_headshot in older CSGO stats. Let's try it.
        // Actually, for CS2, many stats are similar to CSGO.
        // We will just grab K/D/W for now as requested "all the stats"

        const kdRatio = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : totalKills;

        result.stats = {
          totalKills,
          totalDeaths,
          totalWins,
          totalDamage,
          kdRatio,
        };
      }
    } catch (e) {
      // 403/500 if stats are private
      console.log("[steam] GetUserStatsForGame failed (likely private stats):", e.message);
    }

    return res.json(result);
  } catch (err) {
    console.error("[steam] error in /profile-from-url:", err.message);
    return res
      .status(500)
      .send("Steam lookup failed. Please try again later.");
  }
});

module.exports = router;
