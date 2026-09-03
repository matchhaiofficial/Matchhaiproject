import { Redirect } from "expo-router";
import React from "react";

import { buildLegacyMatchroomsHref } from "../../../src/navigation/routes";

export default function MatchroomsIndex() {
  return <Redirect href={buildLegacyMatchroomsHref() as any} />;
}
