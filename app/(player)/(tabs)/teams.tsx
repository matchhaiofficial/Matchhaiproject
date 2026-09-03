import { Redirect } from "expo-router";
import React from "react";

import { buildLegacyTeamsHref } from "../../../src/navigation/routes";

export default function Teams() {
  return <Redirect href={buildLegacyTeamsHref("my") as any} />;
}
