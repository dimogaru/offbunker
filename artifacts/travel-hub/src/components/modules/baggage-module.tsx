import { useState, useRef, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListBaggageItems,
  useCreateBaggageItem,
  useUpdateBaggageItem,
  useDeleteBaggageItem,
  getListBaggageItemsQueryKey,
  useListFlights,
} from "@workspace/api-client-react";
import type { BaggageItem } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Plus, Trash2, ChevronDown, ChevronRight,
  Luggage, AlertTriangle, Briefcase, FileDown, FileUp, X, Check,
} from "lucide-react";

/* ─── Categories ─────────────────────────────────────────────── */

const CATEGORIES = [
  {
    id: "documents_money" as const,
    label: "Documentos y Dinero",
    emoji: "🪪",
    examples: ["Pasaporte", "Visados", "Tarjetas bancarias", "Efectivo", "Seguro de viaje"],
    accent: "border-blue-400 bg-blue-50 dark:bg-blue-950/30",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  {
    id: "electronics" as const,
    label: "Electrónica",
    emoji: "🔌",
    examples: ["Cargador móvil", "Powerbank", "Adaptador universal", "Auriculares", "Cámara"],
    accent: "border-purple-400 bg-purple-50 dark:bg-purple-950/30",
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  },
  {
    id: "clothing" as const,
    label: "Ropa y Calzado",
    emoji: "👕",
    examples: ["Mudas de ropa", "Calzado cómodo", "Abrigo", "Pijama", "Ropa interior"],
    accent: "border-green-400 bg-green-50 dark:bg-green-950/30",
    badge: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  {
    id: "toiletries" as const,
    label: "Aseo y Salud",
    emoji: "🧴",
    examples: ["Líquidos <100ml", "Protector solar", "Medicación", "Cepillo de dientes", "Desodorante"],
    accent: "border-orange-400 bg-orange-50 dark:bg-orange-950/30",
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
  {
    id: "last_minute" as const,
    label: "Último Minuto",
    emoji: "⚡",
    examples: ["Llaves de casa", "Móvil", "Cartera", "Gafas", "Mascarillas"],
    accent: "border-red-400 bg-red-50 dark:bg-red-950/30",
    badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

/* ─── Template helpers (user-scoped) ─────────────────────────── */

type TemplateItem = { name: string; category: CategoryId; isLastMinute: boolean };
type Template = { name: string; items: TemplateItem[] };

function templatesKey(userId: number) { return `offbunker-baggage-templates-${userId}`; }

function loadTemplates(userId: number): Template[] {
  try { return JSON.parse(localStorage.getItem(templatesKey(userId)) || "[]"); } catch { return []; }
}
function persistTemplate(userId: number, t: Template) {
  const existing = loadTemplates(userId).filter((x) => x.name !== t.name);
  localStorage.setItem(templatesKey(userId), JSON.stringify([...existing, t]));
}
function deleteTemplate(userId: number, name: string) {
  const existing = loadTemplates(userId).filter((x) => x.name !== name);
  localStorage.setItem(templatesKey(userId), JSON.stringify(existing));
}

/* ─── Checked-state offline cache (user-scoped) ──────────────── */

function setCachedChecked(tripId: number, itemId: number, checked: boolean, userId: number) {
  try {
    const key = `offbunker-baggage-checked-${tripId}-${userId}`;
    const cache: Record<number, boolean> = JSON.parse(localStorage.getItem(key) || "{}");
    cache[itemId] = checked;
    localStorage.setItem(key, JSON.stringify(cache));
  } catch { /* ignore */ }
}

/* ─── Component ──────────────────────────────────────────────── */

interface Props {
  tripId: number;
  readOnly?: boolean;
}

export default function BaggageModule({ tripId, readOnly }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? 0;

  /* data */
  const { data: items = [], isLoading } = useListBaggageItems(tripId);
  const { data: flights = [] } = useListFlights(tripId);

  /* mutations */
  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: getListBaggageItemsQueryKey(tripId) }),
    [queryClient, tripId],
  );
  const createItem = useCreateBaggageItem({ mutation: { onSuccess: invalidate, onError: () => toast({ title: "Error al añadir ítem", variant: "destructive" }) } });
  const updateItem = useUpdateBaggageItem({ mutation: { onError: () => invalidate() } });
  const deleteItem = useDeleteBaggageItem({ mutation: { onSuccess: invalidate, onError: () => toast({ title: "Error al eliminar", variant: "destructive" }) } });

  /* UI state */
  const [suitcaseMode, setSuitcaseMode] = useState(false);
  const [hideChecked, setHideChecked] = useState(false);
  const [openCategories, setOpenCategories] = useState<Set<CategoryId>>(
    new Set(CATEGORIES.map((c) => c.id)),
  );
  const [addingCategory, setAddingCategory] = useState<CategoryId | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [templatePanelOpen, setTemplatePanelOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const touchStartX = useRef(0);

  /* Load user-scoped templates when userId is known */
  useEffect(() => {
    if (userId) setTemplates(loadTemplates(userId));
  }, [userId]);

  /* ─── Last-minute alert ────────────────────────────────────── */
  const earliestDeparture = flights
    .map((f) => (f.departureTime ? new Date(f.departureTime) : null))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  const hoursUntilDeparture = earliestDeparture
    ? (earliestDeparture.getTime() - Date.now()) / (1000 * 60 * 60)
    : null;

  const showLastMinuteAlert =
    hoursUntilDeparture !== null &&
    hoursUntilDeparture <= 2 &&
    hoursUntilDeparture >= 0;

  const lastMinutePending = items.filter(
    (i) => (i.isLastMinute || i.category === "last_minute") && !i.isChecked,
  );

  /* PWA notification for last-minute items */
  useEffect(() => {
    if (!showLastMinuteAlert || lastMinutePending.length === 0) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const msg = lastMinutePending.map((i) => i.name).join(", ");
    new Notification("⚡ OffBunker — Último Minuto", {
      body: `Faltan por guardar: ${msg}`,
      icon: "/icon-192.png",
    });
  }, [showLastMinuteAlert]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Progress ─────────────────────────────────────────────── */
  const totalItems = items.length;
  const checkedItems = items.filter((i) => i.isChecked).length;

  /* ─── Category helpers ─────────────────────────────────────── */
  const toggleCategory = (id: CategoryId) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const itemsForCategory = (catId: CategoryId) => {
    const list = items.filter((i) => i.category === catId);
    return hideChecked ? list.filter((i) => !i.isChecked) : list;
  };

  /* ─── Check toggle with optimistic update ──────────────────── */
  const toggleCheck = (item: BaggageItem) => {
    const next = !item.isChecked;
    queryClient.setQueryData(
      getListBaggageItemsQueryKey(tripId),
      (old: BaggageItem[] | undefined) =>
        (old ?? []).map((i) => (i.id === item.id ? { ...i, isChecked: next } : i)),
    );
    setCachedChecked(tripId, item.id, next, userId);
    updateItem.mutate({ tripId, itemId: item.id, data: { isChecked: next } });
  };

  /* ─── Move item to last_minute category ────────────────────── */
  const moveToLastMinute = (item: BaggageItem) => {
    updateItem.mutate(
      { tripId, itemId: item.id, data: { category: "last_minute", isLastMinute: true } },
      { onSuccess: invalidate },
    );
    toast({ title: `"${item.name}" movido a Último Minuto` });
  };

  /* ─── Add item ─────────────────────────────────────────────── */
  const handleAdd = (catId: CategoryId) => {
    const name = newItemName.trim();
    if (!name) return;
    createItem.mutate({
      tripId,
      data: {
        name,
        category: catId,
        isLastMinute: catId === "last_minute",
        sortOrder: itemsForCategory(catId).length,
      },
    });
    setNewItemName("");
    setAddingCategory(null);
  };

  /* ─── Swipe gesture ─────────────────────────────────────────── */
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent, item: BaggageItem) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(deltaX) > 60 && deltaX > 0) toggleCheck(item);
  };

  /* ─── Templates ─────────────────────────────────────────────── */
  const handleSaveTemplate = () => {
    const name = saveTemplateName.trim();
    if (!name) return;
    const templateItems: TemplateItem[] = items.map((i) => ({
      name: i.name,
      category: i.category as CategoryId,
      isLastMinute: i.isLastMinute,
    }));
    persistTemplate(userId, { name, items: templateItems });
    setTemplates(loadTemplates(userId));
    setSaveTemplateName("");
    toast({ title: `Plantilla "${name}" guardada` });
  };

  const handleLoadTemplate = (template: Template) => {
    for (const item of template.items) {
      createItem.mutate({
        tripId,
        data: { name: item.name, category: item.category, isLastMinute: item.isLastMinute, sortOrder: 0 },
      });
    }
    setTemplatePanelOpen(false);
    toast({ title: `Plantilla "${template.name}" cargada` });
  };

  const handleDeleteTemplate = (name: string) => {
    deleteTemplate(userId, name);
    setTemplates(loadTemplates(userId));
  };

  /* ─── Request notification permission ──────────────────────── */
  const requestNotifPermission = () => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  /* ─── Render ─────────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className={suitcaseMode ? "text-lg" : ""}>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Luggage className={suitcaseMode ? "w-7 h-7 text-primary" : "w-5 h-5 text-primary"} />
          <h2 className={`font-semibold ${suitcaseMode ? "text-2xl" : "text-xl"}`}>Equipaje</h2>
          {totalItems > 0 && (
            <Badge variant="secondary" className="shrink-0">
              {checkedItems}/{totalItems} guardados
            </Badge>
          )}
        </div>

        {/* Modo Maleta toggle */}
        <Button
          variant={suitcaseMode ? "default" : "outline"}
          size={suitcaseMode ? "default" : "sm"}
          onClick={() => { setSuitcaseMode((v) => !v); requestNotifPermission(); }}
          className={suitcaseMode ? "bg-primary text-primary-foreground font-bold shadow-md" : ""}
        >
          <Briefcase className="w-4 h-4 mr-1.5" />
          {suitcaseMode ? "Salir de Modo Maleta" : "Modo Maleta"}
        </Button>

        {/* Template panel toggle */}
        {!readOnly && (
          <Button variant="ghost" size="sm" onClick={() => setTemplatePanelOpen((v) => !v)}>
            {templatePanelOpen ? <X className="w-4 h-4" /> : <FileDown className="w-4 h-4 mr-1" />}
            {!templatePanelOpen && "Plantillas"}
          </Button>
        )}
      </div>

      {/* ── Modo Maleta toolbar ── */}
      {suitcaseMode && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <Button
            variant={hideChecked ? "default" : "outline"}
            size="sm"
            onClick={() => setHideChecked((v) => !v)}
          >
            {hideChecked ? <Check className="w-4 h-4 mr-1" /> : null}
            {hideChecked ? "Mostrando pendientes" : "Ocultar guardados"}
          </Button>
          <span className="text-sm text-muted-foreground ml-1">
            Desliza ➡️ o pulsa para marcar guardado
          </span>
        </div>
      )}

      {/* ── Last-minute alert ── */}
      {showLastMinuteAlert && lastMinutePending.length > 0 && (
        <div className="mb-4 p-4 rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-950/40 flex gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5 animate-pulse" />
          <div>
            <p className="font-bold text-red-700 dark:text-red-400 text-base">
              ¡Último Minuto! — Tu vuelo sale en{" "}
              {hoursUntilDeparture !== null && hoursUntilDeparture < 1
                ? `${Math.round(hoursUntilDeparture * 60)} minutos`
                : `${hoursUntilDeparture?.toFixed(1)} horas`}
            </p>
            <p className="text-sm text-red-600 dark:text-red-300 mt-1">
              Pendiente de guardar:{" "}
              <strong>{lastMinutePending.map((i) => i.name).join(", ")}</strong>
            </p>
          </div>
        </div>
      )}

      {/* ── Template panel ── */}
      {templatePanelOpen && (
        <div className="mb-4 p-4 rounded-lg border bg-card space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-1.5">
            <FileDown className="w-4 h-4" /> Plantillas de equipaje
          </h3>

          {/* Save current list */}
          <div className="flex gap-2">
            <Input
              placeholder="Nombre de la plantilla (ej: Fin de semana)"
              value={saveTemplateName}
              onChange={(e) => setSaveTemplateName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveTemplate()}
              className="text-sm"
            />
            <Button size="sm" onClick={handleSaveTemplate} disabled={!saveTemplateName.trim() || items.length === 0}>
              <FileUp className="w-4 h-4 mr-1" /> Guardar
            </Button>
          </div>

          {/* Saved templates */}
          {templates.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aún no hay plantillas guardadas.</p>
          ) : (
            <div className="space-y-1.5">
              {templates.map((t) => (
                <div key={t.name} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                  <span className="flex-1 text-sm font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground">{t.items.length} ítems</span>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleLoadTemplate(t)}>
                    Cargar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteTemplate(t.name)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Progress bar ── */}
      {totalItems > 0 && (
        <div className="mb-4">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500 rounded-full"
              style={{ width: `${(checkedItems / totalItems) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {checkedItems === totalItems && totalItems > 0
              ? "✅ Todo guardado en la maleta"
              : `${totalItems - checkedItems} ítem(s) pendiente(s)`}
          </p>
        </div>
      )}

      {/* ── Category accordions ── */}
      <div className="space-y-2">
        {CATEGORIES.map((cat) => {
          const catItems = itemsForCategory(cat.id);
          const allItems = items.filter((i) => i.category === cat.id);
          const checkedCount = allItems.filter((i) => i.isChecked).length;
          const isOpen = openCategories.has(cat.id);

          return (
            <div key={cat.id} className={`rounded-lg border-l-4 ${cat.accent} border border-l-4`}>
              {/* Category header */}
              <button
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className="w-full flex items-center gap-2 px-4 py-3 text-left"
              >
                <span className={suitcaseMode ? "text-2xl" : "text-xl"}>{cat.emoji}</span>
                <span className={`font-semibold flex-1 ${suitcaseMode ? "text-lg" : "text-sm"}`}>
                  {cat.label}
                </span>
                {allItems.length > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.badge}`}>
                    {checkedCount}/{allItems.length}
                  </span>
                )}
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </button>

              {/* Category body */}
              {isOpen && (
                <div className="px-4 pb-3 space-y-1.5">
                  {/* Items */}
                  {catItems.length === 0 && hideChecked && allItems.length > 0 ? (
                    <p className="text-xs text-muted-foreground py-1.5">
                      ✅ Todo guardado en esta categoría
                    </p>
                  ) : catItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-1.5">
                      Sin ítems — añade {cat.examples[0]}, {cat.examples[1]}...
                    </p>
                  ) : null}

                  {catItems.map((item) =>
                    suitcaseMode ? (
                      /* ── Modo Maleta item ── */
                      <div
                        key={item.id}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={(e) => handleTouchEnd(e, item)}
                        onClick={() => toggleCheck(item)}
                        className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer select-none transition-all active:scale-95 ${
                          item.isChecked
                            ? "bg-green-100 dark:bg-green-900/30 opacity-60"
                            : "bg-white dark:bg-zinc-800 shadow-sm"
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            item.isChecked
                              ? "bg-green-500 border-green-500 text-white"
                              : "border-muted-foreground"
                          }`}
                        >
                          {item.isChecked && <Check className="w-5 h-5" />}
                        </div>
                        <span
                          className={`flex-1 text-lg font-medium ${
                            item.isChecked ? "line-through text-muted-foreground" : ""
                          }`}
                        >
                          {item.name}
                        </span>
                        {item.isLastMinute && (
                          <span className="text-red-500 text-sm">⚡</span>
                        )}
                      </div>
                    ) : (
                      /* ── Normal item ── */
                      <div
                        key={item.id}
                        className="flex items-center gap-2 group"
                      >
                        <button
                          type="button"
                          onClick={() => toggleCheck(item)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                            item.isChecked
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground hover:border-primary"
                          }`}
                          aria-label={item.isChecked ? "Marcar como pendiente" : "Marcar como guardado"}
                        >
                          {item.isChecked && <Check className="w-3 h-3" />}
                        </button>

                        <span
                          className={`flex-1 text-sm ${
                            item.isChecked ? "line-through text-muted-foreground" : ""
                          }`}
                        >
                          {item.name}
                          {item.isLastMinute && (
                            <span className="ml-1.5 text-xs text-red-500 font-medium">⚡</span>
                          )}
                        </span>

                        {!readOnly && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {cat.id !== "last_minute" && !item.isLastMinute && (
                              <button
                                type="button"
                                onClick={() => moveToLastMinute(item)}
                                title="Mover a Último Minuto"
                                className="text-xs text-orange-500 hover:text-orange-700 px-1"
                              >
                                ⚡
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                deleteItem.mutate({ tripId, itemId: item.id })
                              }
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              aria-label="Eliminar ítem"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ),
                  )}

                  {/* Add item form */}
                  {!readOnly && !suitcaseMode && (
                    <>
                      {addingCategory === cat.id ? (
                        <div className="flex gap-2 mt-2">
                          <Input
                            autoFocus
                            placeholder={`ej: ${cat.examples[0]}`}
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAdd(cat.id);
                              if (e.key === "Escape") { setAddingCategory(null); setNewItemName(""); }
                            }}
                            className="text-sm h-8"
                          />
                          <Button size="sm" className="h-8 shrink-0" onClick={() => handleAdd(cat.id)} disabled={!newItemName.trim()}>
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 shrink-0" onClick={() => { setAddingCategory(null); setNewItemName(""); }}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setAddingCategory(cat.id); setNewItemName(""); }}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mt-1.5 w-full py-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Añadir ítem
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Empty state ── */}
      {totalItems === 0 && !readOnly && (
        <div className="mt-6 text-center text-muted-foreground text-sm space-y-2">
          <Luggage className="w-12 h-12 mx-auto opacity-20" />
          <p>Tu lista de equipaje está vacía.</p>
          <p>Despliega una categoría y añade los primeros ítems.</p>
        </div>
      )}
    </div>
  );
}
