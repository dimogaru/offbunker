import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  description: string;
  onAdd: () => void;
}

export default function ModuleHeader({ title, description, onAdd }: Props) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-muted-foreground text-sm mt-0.5">{description}</p>
      </div>
      <Button onClick={onAdd} className="gap-2 flex-shrink-0" data-testid="button-add">
        <PlusCircle className="w-4 h-4" />
        Add
      </Button>
    </div>
  );
}
