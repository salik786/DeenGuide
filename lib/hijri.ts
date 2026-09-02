/**
 * Hijri dates are based on astronomical calculation here, not local moon
 * sighting — the real Islamic date can be a day off from this depending on
 * the masjid/region, so this is always labeled "approximate" in the UI.
 */
export function getHijriDateString(): string | null {
  try {
    const hijri = new Intl.DateTimeFormat("en", {
      calendar: "islamic-umalqura",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());
    return hijri;
  } catch {
    return null;
  }
}

export function getGregorianDateString(): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}
