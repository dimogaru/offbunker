import type { Rental } from "@workspace/api-client-react";
import type { PulseCountry } from "./country-types";
import { EUROPE_COUNTRIES } from "./countries-europe";
import { AMERICAS_COUNTRIES } from "./countries-americas";
import { ASIA_OCEANIA_COUNTRIES } from "./countries-asia-oceania";
import { AFRICA_COUNTRIES } from "./countries-africa";

/** Country-level references, not live advisories or nationality-specific entry rules. */
export const PULSE_COUNTRIES: PulseCountry[] = [
  ...EUROPE_COUNTRIES,
  ...AMERICAS_COUNTRIES,
  ...ASIA_OCEANIA_COUNTRIES,
  ...AFRICA_COUNTRIES,
];

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function findCountries(location: string): PulseCountry[] {
  const text = ` ${normalize(location)} `;
  if (!text.trim()) return [];
  return PULSE_COUNTRIES.filter(country => {
    // New Mexico is a US state, not an implicit match for the country México.
    const searchable = country.countryCode === "MX" ? text.replaceAll(" new mexico ", " ") : text;
    return country.tokens.some(token => searchable.includes(` ${normalize(token)} `));
  });
}

export interface PlaceGuidance {
  country: string;
  countryCode: string;
  currency: string;
  currencyCode: string;
  plugs: string;
  voltage: string;
  entryReminder: string;
  source: string;
  payments: string;
  tipping: string;
  transportApps: string[];
  tapWater: string;
  tapWaterStatus: PulseCountry["tapWater"];
  police: string;
  ambulance: string;
  roaming: string;
  emergencySourceUrl: string;
}

/** Literal token matching; never infer a country from a partial substring. */
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
    for (const country of findCountries(value)) {
      if (found.has(country.countryCode)) continue;
      found.set(country.countryCode, {
        country: country.countryName,
        countryCode: country.countryCode,
        currency: country.currency,
        currencyCode: country.currencyCode,
        plugs: country.plugType,
        voltage: country.voltage,
        entryReminder: country.visaInfo,
        source: `${label}: ${value}`,
        payments: country.paymentPreference,
        tipping: country.tippingPolicy,
        transportApps: country.transportApps,
        tapWater: country.tapWaterAdvice,
        tapWaterStatus: country.tapWater,
        police: country.emergencyNumbers.police,
        ambulance: country.emergencyNumbers.ambulance,
        roaming: country.roaming,
        emergencySourceUrl: country.emergencySourceUrl,
      });
    }
  }
  return [...found.values()];
}