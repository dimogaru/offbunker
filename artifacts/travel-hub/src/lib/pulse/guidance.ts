import type { Rental } from "@workspace/api-client-react";

type CountryName =
  | "Reino Unido" | "Japón" | "Estados Unidos" | "España" | "Francia" | "Alemania"
  | "Italia" | "Portugal" | "Países Bajos" | "Bélgica" | "Austria";
type CurrencyCode = "EUR" | "GBP" | "USD" | "JPY";
type Country = { name: CountryName; currency: string; currencyCode: CurrencyCode; plugs: string; voltage: string; entryReminder: string; tokens: string[] };

const COUNTRIES: Country[] = [
  { name: "Reino Unido", currency: "Libra esterlina (GBP)", currencyCode: "GBP", plugs: "G", voltage: "230 V / 50 Hz", entryReminder: "Comprueba si necesitas ETA o visado y revisa las normas de aduanas antes de salir.", tokens: ["reino unido", "united kingdom", "uk", "gran bretana", "great britain", "inglaterra", "england", "londres", "london", "edimburgo", "edinburgh"] },
  { name: "Japón", currency: "Yen japonés (JPY)", currencyCode: "JPY", plugs: "A / B", voltage: "100 V / 50–60 Hz", entryReminder: "Revisa si necesitas visado y los trámites de entrada y aduanas, incluido Visit Japan Web si corresponde.", tokens: ["japon", "japan", "tokio", "tokyo", "osaka", "kioto", "kyoto"] },
  { name: "Estados Unidos", currency: "Dólar estadounidense (USD)", currencyCode: "USD", plugs: "A / B", voltage: "120 V / 60 Hz", entryReminder: "Comprueba si necesitas ESTA o visado y qué declaraciones de aduanas corresponden.", tokens: ["estados unidos", "united states", "usa", "eeuu", "ee uu", "new york", "nueva york", "los angeles", "san francisco", "washington dc"] },
  { name: "España", currency: "Euro (EUR)", currencyCode: "EUR", plugs: "C / F", voltage: "230 V / 50 Hz", entryReminder: "Comprueba las condiciones de entrada y aduanas aplicables.", tokens: ["espana", "spain", "madrid", "barcelona", "sevilla", "valencia espana"] },
  { name: "Francia", currency: "Euro (EUR)", currencyCode: "EUR", plugs: "C / E", voltage: "230 V / 50 Hz", entryReminder: "Comprueba las condiciones de entrada y aduanas aplicables.", tokens: ["francia", "france", "paris francia", "paris france", "lyon", "marsella", "marseille"] },
  { name: "Alemania", currency: "Euro (EUR)", currencyCode: "EUR", plugs: "C / F", voltage: "230 V / 50 Hz", entryReminder: "Comprueba las condiciones de entrada y aduanas aplicables.", tokens: ["alemania", "germany", "berlin", "berlín", "munich", "múnich", "hamburgo"] },
  { name: "Italia", currency: "Euro (EUR)", currencyCode: "EUR", plugs: "C / F / L", voltage: "230 V / 50 Hz", entryReminder: "Comprueba las condiciones de entrada y aduanas aplicables.", tokens: ["italia", "italy", "roma italia", "rome italy", "milan", "milano", "florencia"] },
  { name: "Portugal", currency: "Euro (EUR)", currencyCode: "EUR", plugs: "C / F", voltage: "230 V / 50 Hz", entryReminder: "Comprueba las condiciones de entrada y aduanas aplicables.", tokens: ["portugal", "lisboa", "lisbon", "oporto", "porto portugal"] },
  { name: "Países Bajos", currency: "Euro (EUR)", currencyCode: "EUR", plugs: "C / F", voltage: "230 V / 50 Hz", entryReminder: "Comprueba las condiciones de entrada y aduanas aplicables.", tokens: ["paises bajos", "netherlands", "holanda", "amsterdam", "rotterdam"] },
  { name: "Bélgica", currency: "Euro (EUR)", currencyCode: "EUR", plugs: "C / E", voltage: "230 V / 50 Hz", entryReminder: "Comprueba las condiciones de entrada y aduanas aplicables.", tokens: ["belgica", "belgium", "bruselas", "brussels"] },
  { name: "Austria", currency: "Euro (EUR)", currencyCode: "EUR", plugs: "C / F", voltage: "230 V / 50 Hz", entryReminder: "Comprueba las condiciones de entrada y aduanas aplicables.", tokens: ["austria", "viena", "vienna", "salzburgo"] },
];

type CountryTips = Pick<PlaceGuidance, "payments" | "tipping" | "transportApps" | "tapWater" | "tapWaterStatus" | "police" | "ambulance" | "roaming" | "emergencySourceUrl">;
const EU_SAFETY = {
  tapWaterStatus: "Potable" as const,
  tapWater: "Generalmente potable en la red pública; respeta los avisos locales.",
  police: "112",
  ambulance: "112",
  roaming: "Con una SIM de la UE suele aplicarse «roaming como en casa» en estancias temporales, con límites de uso razonable. Con otra SIM, consulta tu tarifa; eSIM opcional.",
  emergencySourceUrl: "https://digital-strategy.ec.europa.eu/en/policies/112",
};
const EU_HABITS = {
  payments: "Tarjeta habitual en ciudades; lleva algo de efectivo para pequeños comercios.",
  tipping: "No obligatoria; es habitual redondear o dejar algo extra por buen servicio.",
};
const TIPS: Record<CountryName, CountryTips> = {
  "Reino Unido": {
    payments: "Tarjeta/contactless muy habitual; lleva efectivo de respaldo.",
    tipping: "En restaurantes con servicio puede dejarse propina si no está incluido el cargo de servicio.",
    transportApps: ["Uber", "FreeNow"],
    tapWaterStatus: "Potable",
    tapWater: "Generalmente potable en la red pública; respeta avisos locales.",
    police: "999 / 112", ambulance: "999 / 112",
    roaming: "El roaming de la UE no está garantizado aquí. Consulta tu operador; una eSIM puede servir de alternativa.",
    emergencySourceUrl: "https://www.gov.uk/guidance/999-and-112-the-uks-national-emergency-numbers",
  },
  "Japón": {
    payments: "La tarjeta se acepta en muchos lugares, pero lleva efectivo para negocios pequeños y trayectos.",
    tipping: "No es costumbre dejar propina.",
    transportApps: ["GO", "Uber"],
    tapWaterStatus: "Potable",
    tapWater: "Generalmente potable en la red pública; respeta avisos locales.",
    police: "110", ambulance: "119",
    roaming: "Consulta si tu tarifa incluye Japón. Una eSIM o SIM local puede ser útil; no es obligatoria.",
    emergencySourceUrl: "https://www.japan.travel/en/plan/hotline/",
  },
  "Estados Unidos": {
    payments: "Tarjeta muy habitual; lleva un medio de pago alternativo.",
    tipping: "En restaurantes con servicio suele esperarse propina; revisa si ya se añadió el cargo.",
    transportApps: ["Uber", "Lyft"],
    tapWaterStatus: "Potable",
    tapWater: "En redes públicas suele ser potable; consulta los avisos de agua de tu localidad.",
    police: "911", ambulance: "911",
    roaming: "Consulta los costes de tu operador antes de salir; eSIM opcional si necesitas datos locales.",
    emergencySourceUrl: "https://www.911.gov/calling-911/",
  },
  "España": { ...EU_SAFETY, ...EU_HABITS, transportApps: ["Cabify", "Uber", "FreeNow"] },
  "Francia": { ...EU_SAFETY, ...EU_HABITS, transportApps: ["Uber", "G7", "Bolt"] },
  "Alemania": {
    ...EU_SAFETY, ...EU_HABITS,
    payments: "La tarjeta es habitual, pero el efectivo sigue siendo útil en pequeños negocios.",
    transportApps: ["FreeNow", "Bolt", "Uber"],
  },
  "Italia": { ...EU_SAFETY, ...EU_HABITS, transportApps: ["FreeNow", "itTaxi"] },
  "Portugal": { ...EU_SAFETY, ...EU_HABITS, transportApps: ["Bolt", "Uber"] },
  "Países Bajos": { ...EU_SAFETY, ...EU_HABITS, transportApps: ["Uber", "Bolt"] },
  "Bélgica": { ...EU_SAFETY, ...EU_HABITS, transportApps: ["Uber", "Bolt"] },
  "Austria": { ...EU_SAFETY, ...EU_HABITS, transportApps: ["FreeNow", "Bolt"] },
};

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function findCountry(location: string): Country | undefined {
  const text = ` ${normalize(location)} `;
  if (!text.trim()) return undefined;
  return COUNTRIES.find(country => country.tokens.some(token => text.includes(` ${normalize(token)} `)));
}

export interface PlaceGuidance {
  country: string;
  currency: string;
  currencyCode: CurrencyCode;
  plugs: string;
  voltage: string;
  entryReminder: string;
  source: string;
  payments: string;
  tipping: string;
  transportApps: string[];
  tapWater: string;
  tapWaterStatus: "Potable" | "No potable" | "Consultar";
  police: string;
  ambulance: string;
  roaming: string;
  emergencySourceUrl: string;
}

/** Conservative literal matching: no geocoding, and never infers from a partial substring. */
export function getPlaceGuidance(destination: string, rentals: Rental[] = []): PlaceGuidance[] {
  const locations = [
    { label: "Destino del viaje", value: destination },
    ...rentals.flatMap(r => [
      { label: "Transporte · origen", value: r.originStation ?? r.pickupLocation ?? "" },
      { label: "Transporte · destino", value: r.destinationStation ?? r.returnLocation ?? "" },
      { label: "Transporte · recogida", value: r.pickupLocation ?? "" },
      { label: "Transporte · devolución", value: r.returnLocation ?? "" },
    ]),
  ];
  const found = new Map<string, PlaceGuidance>();
  for (const { label, value } of locations) {
    const country = findCountry(value);
    if (country && !found.has(country.name)) {
      found.set(country.name, {
        country: country.name, currency: country.currency, currencyCode: country.currencyCode,
        plugs: country.plugs, voltage: country.voltage, entryReminder: country.entryReminder,
        source: `${label}: ${value}`, ...TIPS[country.name],
      });
    }
  }
  return [...found.values()];
}