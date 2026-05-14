import { useGetTripProgress, getGetTripProgressQueryKey } from "@workspace/api-client-react";

interface Props {
  tripId: number;
  compact?: boolean;
}

export default function TripProgressBar({ tripId, compact }: Props) {
  const { data: progress, isLoading } = useGetTripProgress(tripId, {
    query: { queryKey: getGetTripProgressQueryKey(tripId) },
  });

  if (isLoading || !progress) {
    return (
      <div className="space-y-1">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full w-0 bg-primary rounded-full" />
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">
            {progress.completedModules}/{progress.totalModules} módulos listos
          </span>
          <span className="text-xs font-medium text-primary">{progress.percentComplete}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress.percentComplete}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium">Progreso de preparación</span>
        <span className="text-sm font-bold text-primary">{progress.percentComplete}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${progress.percentComplete}%` }}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {progress.moduleBreakdown.map((m) => (
          <div key={m.module} className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${m.hasDocuments ? "bg-primary" : "bg-muted-foreground/30"}`}
            />
            <span className={`text-xs truncate ${m.hasDocuments ? "text-foreground" : "text-muted-foreground"}`}>
              {m.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
