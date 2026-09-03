import * as Clipboard from "expo-clipboard";
import { Linking } from "react-native";

export function canOpenMaps(mapUrl?: string | null, address?: string | null) {
  return Boolean(String(mapUrl || "").trim() || String(address || "").trim());
}

export async function handleOpenGoogleMaps(input: {
  mapUrl?: string | null;
  address?: string | null;
}) {
  const explicitUrl = String(input.mapUrl || "").trim();
  const address = String(input.address || "").trim();
  const fallbackUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : "";
  const target = explicitUrl || fallbackUrl;

  if (!target) {
    return { ok: false as const, message: "Google Maps link is not available for this branch." };
  }

  try {
    await Linking.openURL(target);
    return { ok: true as const };
  } catch (error: any) {
    return {
      ok: false as const,
      message: error?.message || "Could not open Google Maps right now.",
    };
  }
}

export async function handleCopyAddress(address?: string | null) {
  const resolvedAddress = String(address || "").trim();
  if (!resolvedAddress) {
    return { ok: false as const, message: "Address is not available for this branch." };
  }

  try {
    await Clipboard.setStringAsync(resolvedAddress);
    return { ok: true as const };
  } catch (error: any) {
    return {
      ok: false as const,
      message: error?.message || "Could not copy the address right now.",
    };
  }
}

export async function handleCallVenue(phone?: string | null) {
  const normalizedPhone = String(phone || "").trim();
  if (!normalizedPhone) {
    return { ok: false as const, message: "Phone number is not available for this venue." };
  }

  const phoneUrl = `tel:${normalizedPhone}`;

  try {
    const supported = await Linking.canOpenURL(phoneUrl);
    if (!supported) {
      return { ok: false as const, message: "Calling is not supported on this device." };
    }

    await Linking.openURL(phoneUrl);
    return { ok: true as const };
  } catch (error: any) {
    return {
      ok: false as const,
      message: error?.message || "Could not start the call right now.",
    };
  }
}
