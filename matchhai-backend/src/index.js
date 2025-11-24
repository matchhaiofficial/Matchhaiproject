const express = require("express");
const cors = require("cors");
require("dotenv").config();

const steamRoutes = require("./routes/steam");
const faceitRoutes = require("./routes/faceit");
const zonesRoutes = require("./routes/zones");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ ok: true, message: "MatchHai backend is running" });
});

app.use("/steam", steamRoutes);
app.use("/faceit", faceitRoutes);
app.use("/zones", zonesRoutes); // 👈 new

app.listen(PORT, () => {
  console.log(`MatchHai backend listening on port ${PORT}`);
});
