export function getCanonicalGameLabel(value?: string | null): string {
  const key = String(value || "").trim().toLowerCase();

  switch (key) {
    case "cs2":
      return "CS2";
    case "cs16":
      return "CS 1.6";
    case "valorant":
      return "Valorant";
    case "fc25":
    case "fc26":
      return "FC26";
    case "tekken8":
      return "Tekken 8";
    case "futsal":
      return "Futsal";
    case "indoor_cricket":
      return "Indoor Cricket";
    case "padel":
      return "Padel";
    case "pickleball":
      return "Pickleball";
    default:
      return key ? key.toUpperCase() : "Game";
  }
}
