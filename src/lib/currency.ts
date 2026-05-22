// Currency is derived from the academy's country (ISO-3166 alpha-2), so an academy
// always operates in its national currency without anyone picking it manually.
// Pure + dependency-free (importable from server actions, seed and the backfill).

// Eurozone members all map to EUR.
const EUROZONE = ["AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES"];

const COUNTRY_CURRENCY: Record<string, string> = {
  ...Object.fromEntries(EUROZONE.map((c) => [c, "EUR"])),
  NO: "NOK", SE: "SEK", DK: "DKK", IS: "ISK",
  GB: "GBP", CH: "CHF",
  US: "USD", CA: "CAD", AU: "AUD", NZ: "NZD",
  PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", BG: "BGN",
  RU: "RUB", UA: "UAH", TR: "TRY",
  JP: "JPY", CN: "CNY", KR: "KRW", IN: "INR", SG: "SGD", HK: "HKD",
  AE: "AED", SA: "SAR", IL: "ILS", QA: "QAR",
  BR: "BRL", AR: "ARS", CL: "CLP", MX: "MXN", ZA: "ZAR",
};

// Resolve the operating currency for a country code. Falls back to EUR.
export function currencyForCountry(country: string | null | undefined): string {
  if (!country) return "EUR";
  return COUNTRY_CURRENCY[country.trim().toUpperCase()] ?? "EUR";
}
