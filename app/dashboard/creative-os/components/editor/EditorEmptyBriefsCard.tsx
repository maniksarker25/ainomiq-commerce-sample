"use client";

import { Layers3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { CreativeOsCard } from "../../_components/CreativeOsCard";

export function EditorEmptyBriefsCard() {
  return (
    <CreativeOsCard>
      <CardContent className="p-4 md:p-5">
        <Badge variant="secondary" className="gap-1.5 px-3 py-1">
          <Layers3 size={14} />
          Creative OS editor
        </Badge>
        <h2 className="mt-3 text-xl font-bold tracking-tight text-foreground">
          Access connected. No briefs assigned yet.
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Your invite is accepted for this workspace, but no ad brief has been
          assigned to this exact email yet. You can read the Brand tab now; ask
          the workspace owner to assign a brief when work is ready.
        </p>
      </CardContent>
    </CreativeOsCard>
  );
}
