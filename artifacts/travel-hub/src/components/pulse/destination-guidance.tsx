import { useState } from "react";
import { AlertCircle, ArrowRight, Banknote, CircleHelp, CreditCard, Droplets, Globe2, HeartPulse, MapPin, Phone, PlugZap, Smartphone, Wallet, Zap } from "lucide-react";
import { getGetExpenseRatesQueryKey, getListRentalsQueryKey, useGetExpenseRates, useListRentals } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { getPlaceGuidance } from "@/lib/pulse/guidance";

interface Props {
  tripId: number;
  destination: string;
}

function Detail({ icon: Icon, label, children }: { icon: typeof PlugZap; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-xl border border-border/70 bg-background p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
        <div className="mt-1 text-sm leading-snug text-foreground">{children}</div>
      </div>
    </div>
  );
}

function displayDate(value: string | undefined) {
  if (!value) return "fecha no disponible";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function formatMoney(amount: number, code: string) {
  try {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: code, maximumFractionDigits: code === "JPY" ? 0 : 2 }).format(amount);
  } catch {
    return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(amount)} ${code}`;
  }
}

export default function DestinationGuidance({ tripId, destination }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [amount, setAmount] = useState("100");
  const { isOnline } = useOnlineStatus();
  const { user } = useAuth();
  const isDemo = user?.role === "demo";
  const { data: rentals, isLoading: rentalsLoading, isError: rentalsError } = useListRentals(tripId, {
    query: { enabled: isOnline && open, queryKey: getListRentalsQueryKey(tripId) },
  });
  const guidance = getPlaceGuidance(destination, rentals ?? []);
  const { data: rates, isLoading: ratesLoading, isError: ratesError, refetch: retryRates } = useGetExpenseRates(tripId, {
    query: { enabled: open && isOnline && !isDemo && guidance.length > 0, queryKey: getGetExpenseRatesQueryKey(tripId) },
  });
  const place = guidance.find(item => item.country === selectedCountry) ?? guidance[0];
  const baseCurrency = rates?.baseCurrency;
  const localCurrency = place?.currencyCode;
  const parsedAmount = amount.trim() === "" ? NaN : Number(amount.trim().replace(",", "."));
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount >= 0 && parsedAmount <= 1_000_000_000;
  const sameCurrency = !!baseCurrency && baseCurrency === localCurrency;
  // Expense rates are stored as base-currency units for one unit of the local currency.
  const referenceRate = localCurrency && rates?.rates ? rates.rates[localCurrency] : undefined;
  const usableRate = typeof referenceRate === "number" && Number.isFinite(referenceRate) && referenceRate > 0;
  const canConvert = !!baseCurrency && !!localCurrency && (sameCurrency || usableRate);
  const converted = validAmount && canConvert ? (sameCurrency ? parsedAmount : parsedAmount / referenceRate!) : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="gap-1.5" data-testid="button-pulse-destination">
          <Zap className="h-4 w-4" aria-hidden="true" /> Pistas del destino
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(88dvh,740px)] w-[calc(100vw-1.25rem)] max-w-xl flex-col gap-0 overflow-hidden rounded-2xl p-0">
        <DialogHeader className="shrink-0 border-b border-border bg-primary/5 px-4 pb-3 pt-5 text-left sm:px-5">
          <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            <Globe2 className="h-3.5 w-3.5" aria-hidden="true" /> Vista previa
          </div>
          <DialogTitle className="pr-8 text-xl tracking-tight">OffBunker Pulse — Pistas de destino</DialogTitle>
          <DialogDescription className="pr-4 text-xs leading-relaxed">Una referencia rápida para preparar el viaje. Confirma los datos sensibles antes de salir.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-5">
          {rentalsLoading && !rentals && <p role="status" className="mb-3 text-xs text-muted-foreground">Consultando los lugares del viaje…</p>}
          {place ? (
            <>
              {guidance.length > 1 && (
                <div className="mb-3">
                  <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">País del recorrido</p>
                  <div className="flex flex-wrap gap-1.5" aria-label="Seleccionar país">
                    {guidance.map(item => (
                      <button
                        key={item.country}
                        type="button"
                        onClick={() => setSelectedCountry(item.country)}
                        aria-pressed={place.country === item.country}
                        data-testid={`button-country-${item.country}`}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${place.country === item.country ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
                      >
                        {item.country}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-1.5 text-base font-semibold" data-testid="text-guidance-country"><MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />{place.country}</h3>
                  <p className="mt-0.5 break-words pl-5 text-[11px] text-muted-foreground" data-testid="text-guidance-source">Detectado en {place.source}</p>
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">Orientativo</span>
              </div>

              <Tabs defaultValue="electricidad" className="w-full">
                <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-xl p-1">
                  <TabsTrigger value="electricidad" className="min-w-0 whitespace-normal px-1 py-2 text-center text-[11px] leading-tight sm:text-xs" data-testid="tab-electricidad">Electricidad<br className="sm:hidden" /> y Moneda</TabsTrigger>
                  <TabsTrigger value="logistica" className="min-w-0 whitespace-normal px-1 py-2 text-center text-[11px] leading-tight sm:text-xs" data-testid="tab-logistica">Logística<br className="sm:hidden" /> y Pagos</TabsTrigger>
                  <TabsTrigger value="salud" className="min-w-0 whitespace-normal px-1 py-2 text-center text-[11px] leading-tight sm:text-xs" data-testid="tab-salud">Salud<br className="sm:hidden" /> y Emergencias</TabsTrigger>
                </TabsList>

                <TabsContent value="electricidad" className="space-y-2 pt-1">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Detail icon={PlugZap} label="Enchufes y tensión"><strong>Tipo {place.plugs}</strong> · {place.voltage}<span className="mt-1 block text-xs text-muted-foreground">Comprueba la compatibilidad de tus dispositivos.</span></Detail>
                    <Detail icon={Wallet} label="Moneda"><strong>{place.currency}</strong><span className="mt-1 block text-xs text-muted-foreground">Código {place.currencyCode}</span></Detail>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/40 p-3" data-testid="card-reference-converter">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold">Conversor de referencia</p>
                      {rates?.date && <span className="text-[10px] text-muted-foreground">Tasa del {displayDate(rates.date)}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="min-w-0 flex-1 text-[11px] font-medium text-muted-foreground" htmlFor="guidance-amount">
                        Importe {baseCurrency ? `en ${baseCurrency}` : "en moneda base"}
                        <input id="guidance-amount" data-testid="input-guidance-amount" type="text" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} aria-invalid={!validAmount} className="mt-1 block h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                      </label>
                      <ArrowRight className="mt-4 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-muted-foreground">En {localCurrency}</p>
                        <p className="mt-1 flex min-h-9 items-center break-words rounded-lg bg-background px-2.5 text-sm font-semibold" aria-live="polite" data-testid="text-guidance-converted">
                          {converted === null ? "—" : formatMoney(converted, localCurrency)}
                        </p>
                      </div>
                    </div>
                    {!validAmount && <p role="alert" className="mt-1.5 text-xs text-destructive">Introduce un importe válido entre 0 y 1.000.000.000.</p>}
                    {sameCurrency && <p className="mt-2 text-[11px] text-muted-foreground">Misma moneda: conversión 1:1, sin tipo de cambio.</p>}
                    {!sameCurrency && usableRate && baseCurrency && localCurrency && <p className="mt-2 text-[11px] text-muted-foreground" data-testid="text-guidance-rate">1 {localCurrency} = {new Intl.NumberFormat("es-ES", { maximumFractionDigits: 6 }).format(referenceRate!)} {baseCurrency} · referencia del {displayDate(rates?.date)}. La tasa de tu banco puede variar.{!isOnline ? " Dato guardado; estás sin conexión." : ratesError ? " Dato guardado; no se pudo actualizar." : ""}</p>}
                    {!sameCurrency && !usableRate && (
                      <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground" role="status" data-testid="status-guidance-rate">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{isDemo ? "La sesión invitada no consulta cotizaciones. Conversión no disponible." : !isOnline ? "Sin conexión y sin tasa guardada. Conversión no disponible." : ratesLoading ? "Consultando el tipo de cambio…" : ratesError ? "No se pudo consultar el tipo de cambio. Conversión no disponible." : "No hay tipo de cambio disponible para esta moneda."}</span>
                        {!isDemo && isOnline && ratesError && <button type="button" onClick={() => void retryRates()} className="shrink-0 font-semibold text-primary underline underline-offset-2" data-testid="button-retry-guidance-rate">Reintentar</button>}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="logistica" className="space-y-2 pt-1">
                  <Detail icon={CreditCard} label="Tarjeta y efectivo">{place.payments}</Detail>
                  <Detail icon={Banknote} label="Propinas">{place.tipping}</Detail>
                  <Detail icon={MapPin} label="Apps de transporte">{place.transportApps.length ? <span>{place.transportApps.join(" · ")}<span className="mt-1 block text-xs text-muted-foreground">Consulta disponibilidad y cobertura según la ciudad.</span></span> : "Consulta las opciones locales antes de viajar."}</Detail>
                </TabsContent>

                <TabsContent value="salud" className="space-y-2 pt-1">
                  <Detail icon={Droplets} label="Agua del grifo">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${place.tapWaterStatus === "Potable" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"}`}>{place.tapWaterStatus} en general</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{place.tapWater}</span>
                  </Detail>
                  <div className="grid grid-cols-2 gap-2">
                    <Detail icon={Phone} label="Policía"><strong className="text-base" data-testid="text-guidance-police">{place.police}</strong></Detail>
                    <Detail icon={HeartPulse} label="Ambulancia"><strong className="text-base" data-testid="text-guidance-ambulance">{place.ambulance}</strong></Detail>
                  </div>
                  <Detail icon={Smartphone} label="Roaming y eSIM">{place.roaming}</Detail>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">Los números pueden variar por región o red. Compruébalos antes de viajar. {place.emergencySourceUrl && <a href={place.emergencySourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2" data-testid="link-emergency-source">Fuente de emergencias</a>}</p>
                </TabsContent>
              </Tabs>

              <div className="mt-3 rounded-xl border border-border bg-background p-3 text-xs leading-relaxed">
                <p className="mb-1 font-semibold">Entrada, visado y aduanas</p>
                <p className="text-muted-foreground">{place.entryReminder} Verifica los requisitos vigentes en fuentes oficiales según tu pasaporte, ruta y fechas; esta vista no determina si necesitas visado.</p>
              </div>
              {(!rentals && !isOnline || rentalsError) && <p className="mt-2 text-[11px] text-muted-foreground">No se pudieron revisar los transportes; se muestran solo los lugares disponibles.</p>}
            </>
          ) : (
            <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground" role="status">
              <CircleHelp className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <p>No hay orientación verificada para este destino{rentalsLoading ? " todavía" : ""}. {isOnline ? "Añade un país explícito al viaje o a Transportes para mostrar referencias." : "Sin conexión; no hay datos locales suficientes para identificar el país."}</p>
            </div>
          )}
        </div>
        <div className="flex shrink-0 justify-end border-t border-border bg-background px-4 py-3 sm:px-5">
          <DialogClose asChild><Button type="button" size="sm" variant="outline" data-testid="button-close-guidance">Cerrar</Button></DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}