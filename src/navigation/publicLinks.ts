type AccountRouteKind = "player" | "zone" | "super_admin";

const MATCHHAI_WEB_ORIGIN = "https://matchhai.com";

function toPublicPath(href: string) {
  const value = String(href || "").trim();
  if (!value) return "";
  if (value.startsWith("/")) return value;

  try {
    const url = new URL(value);
    if (url.protocol === "matchhai:") {
      const path = [url.hostname, url.pathname.replace(/^\/+/, "")]
        .filter(Boolean)
        .join("/");
      return `/${path}${url.search}`;
    }
    if (url.origin === MATCHHAI_WEB_ORIGIN) {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    return value;
  }

  return value;
}

export function resolvePublicAppHref(
  href: string,
  accountKind: AccountRouteKind = "player",
) {
  const path = toPublicPath(href);
  const [pathname, query = ""] = path.split("?", 2);
  const suffix = query ? `?${query}` : "";

  const venueMatch = pathname.match(/^\/venues\/([^/]+)\/?$/);
  if (venueMatch) return `/zones/${venueMatch[1]}${suffix}`;

  const bookingMatch = pathname.match(/^\/booking\/([^/]+)\/?$/);
  if (bookingMatch) return `/matchrooms/book/status/${bookingMatch[1]}${suffix}`;

  if (/^\/notifications\/?$/.test(pathname)) {
    if (accountKind === "zone") return "/zone/modules/notifications";
    if (accountKind === "super_admin") return "/super-admin/notifications";
    return "/inbox";
  }

  if (/^\/wallet\/?$/.test(pathname) && accountKind === "zone") {
    return "/zone/wallet";
  }

  return path;
}
