import { Redirect, useLocalSearchParams } from "expo-router";

export default function VenueDeepLinkAlias() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <Redirect href={`/zones/${String(id || "")}` as any} />;
}
