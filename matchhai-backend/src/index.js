// src/index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const steamRoutes = require("./routes/steam");
const faceitRoutes = require("./routes/faceit");

const app = express();
const PORT = process.env.PORT || 4000;

app.use((req, res, next) => {
  console.log("[HTTP]", req.method, req.url);
  next();
});

app.use(cors());
app.use(express.json());

// Mount route modules
app.use("/steam", steamRoutes);   // -> /steam/profile-from-url
app.use("/faceit", faceitRoutes); // -> /faceit/profile-from-value

// Simple health route
app.get("/health", (req, res) => {
  res.json({ ok: true, message: "MatchHai backend healthy" });
});

app.listen(PORT, () => {
  console.log(`MatchHai backend listening on port ${PORT}`);
});
