import type { Rental } from "@workspace/api-client-react";

type Country = { name: string; currency: string; plugs: string; voltage: string; entryReminder: string; tokens: string[] };

const COUNTRIES: Country[] = [
  { name: "Reino Unido", currency: "Libra esterlina (GBP)", plugs: "G", voltage: "230 V / 50 Hz", entryReminder: "Comprueba si necesitas ETA o visado y revisa las normas de aduanas antes de salir.", tokens: ["reino unido", "united kingdom", "uk", "gran bretana", "great britain", "inglaterra", "england", "londres", "london", "edimburgo", "edinburgh"] },
  { name: "Japón", currency: "Yen japonés (JPY)", plugs: "A / B", voltage: "100 V / 50–60 Hz", entryReminder: "Revisa si necesitas visado y los trámites de entrada y aduanas, incluido Visit Japan Web si corresponde.", tokens: ["japon", "japan", "tokio", "tokyo", "osaka", "kioto", "kyoto"] },
  { name: "Estados Unidos", currency: "Dólar estadounidense (USD)", plugs: "A / B", voltage: "120 V / 60 Hz", entryReminder: "Comprueba si necesitas ESTA o visado y qué declaraciones de aduanas corresponden.", tokens: ["estados unidos", "united states", "usa", "eeuu", "ee uu", "new york", "nueva york", "los angeles", "san francisco", "washington dc"] },
  { name: "España", currency: "Euro (EUR)", plugs: "C / F", voltage: "230 V / 50 Hz", entryReminder: "Comprueba las condiciones de entrada y aduanas aplicables.", tokens: ["espana", "spain", "madrid", "barcelona", "sevilla", "valencia espana"] },
  { name: "Francia", currency: "Euro (EUR)", plugs: "C / E", voltage: "230 V / 50 Hz", entryReminder: "Comprueba las condiciones de entrada y aduanas aplicables.", tokens: ["francia", "france", "paris francia", "paris france", "lyon", "marsella", "marseille"] },
  { name: "Alemania", currency: "Euro (EUR)", plugs: "C / F", voltage: "230 V / 50 Hz", entryReminder: "Comprueba las condiciones de entrada y aduanas aplicables.", tokens: ["alemania", "germany", "berlin", "berlín", "munich", "múnich", "hamburgo"] },
  { name: "Italia", currency: "Euro (EUR)", plugs: "C / F / L", voltage: "230 V / 50 Hz", entryReminder: "Comprueba las condiciones de entrada y aduanas aplicables.", tokens: ["italia", "italy", "roma italia", "rome italy", "milan", "milano", "florencia"] },
  { name: "Portugal", currency: "Euro (EUR)", plugs: "C / F", voltage: "230 V / 50 Hz", entryReminder: "Comprueba las condiciones de entrada y aduanas aplicables.", tokens: ["portugal", "lisboa", "lisbon", "oporto", "porto portugal"] },
  { name: "Países Bajos", currency: "Euro (EUR)", plugs: "C / F", voltage: "230 V / 50 Hz", entryReminder: "Comprueba las condiciones de entrada y aduanas aplicables.", tokens: ["paises bajos", "netherlands", "holanda", "amsterdam", "rotterdam"] },
  { name: "Bélgica", currency: "Euro (EUR)", plugs: "C / E", voltage: "230 V / 50 Hz", entryReminder: "Comprueba las condiciones de entrada y aduanas aplicables.", tokens: ["belgica", "belgium", "bruselas", "brussels"] },
  { name: "Austria", currency: "Euro (EUR)", plugs: "C / F", voltage: "230 V / 50 Hz", entryReminder: "Comprueba las condiciones de entrada y aduanas aplicables.", tokens: ["austria", "viena", "vienna", "salzburgo"] },
];

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
  plugs: string;
  voltage: string;
  entryReminder: string;
  source: string;
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
      found.set(country.name, { country: country.name, currency: country.currency, plugs: country.plugs, voltage: country.voltage, entryReminder: country.entryReminder, source: `${label}: ${value}` });
    }
  }
  return [...found.values()];
}