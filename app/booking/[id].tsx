import { Redirect, useLocalSearchParams } from "expo-router";

export default function BookingDeepLinkAlias() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <Redirect href={`/matchrooms/book/${String(id || "")}` as any} />;
}
