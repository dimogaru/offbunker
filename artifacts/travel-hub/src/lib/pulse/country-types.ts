/** Curated, country-level travel references. Local conditions and entry rules can change. */
export interface PulseCountry {
  countryCode: string; // ISO 3166-1 alpha-2
  countryName: string;
  tokens: string[];
  plugType: string;
  voltage: string;
  currency: string;
  currencyCode: string; // ISO 4217
  tippingPolicy: string;
  paymentPreference: string;
  transportApps: string[];
  tapWater: "Potable" | "No potable" | "Consultar";
  tapWaterAdvice: string;
  emergencyNumbers: { police: string; ambulance: string };
  emergencySourceUrl: string;
  visaInfo: string;
  roaming: string;
}

// Maintained reference, not a government source. IEC retired its country guide.
export const ELECTRICITY_SOURCE_URL = "https://www.worldstandards.eu/electricity/plug-voltage-by-country/";

export const EU_ROAMING =
  "Con una SIM de la UE suele aplicarse «roaming como en casa» en estancias temporales, con límites de uso razonable. Con otra SIM, consulta tu tarifa; eSIM opcional.";
export const OTHER_ROAMING =
  "Comprueba los costes y la cobertura de tu operador antes de salir; una eSIM o SIM local puede ser útil, pero no es obligatoria.";