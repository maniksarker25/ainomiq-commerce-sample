"use client";

import { BarChart3 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Metric } from "../../_components/StatCard";
import { SectionTitle } from "../shared/SectionTitle";
import type { LearningTabProps } from "@/app/dashboard/creative-os/components/tabs/types";

export function LearningTab(props: LearningTabProps) {
  const { sectionRefs, workspacePerformance } = props;

  return (
    <div
      ref={(el) => {
        sectionRefs.current.learning = el;
      }}
      className="space-y-4"
    >
      <SectionTitle
        title="Learning loop"
        subtitle="After launch, add performance so the next tasks use winners and avoid losers."
      />

      {workspacePerformance.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {workspacePerformance.map((record) => (
            <Card
              key={record.id}
              className="rounded-2xl shadow-none ring-primary/10"
            >
              <CardContent className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      Launch {record.launchItemId}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Outcome: {record.outcome}
                    </div>
                  </div>
                  <Badge variant="outline" className="gap-1.5 px-2.5 py-1">
                    <BarChart3 size={14} className="text-primary" />
                    Performance
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <Metric label="Spend" value={`€${record.spend}`} />
                  <Metric label="ROAS" value={`${record.roas.toFixed(1)}x`} />
                  <Metric label="CPA" value={`€${record.cpa}`} />
                  <Metric label="CTR" value={`${record.ctr}%`} />
                  <Metric label="Hook" value={`${record.hookRate}%`} />
                  <Metric label="Hold" value={`${record.holdRate}%`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Alert className="border-dashed">
          <AlertDescription>
            No launch data yet. Approve creatives in Review queue, launch them,
            then performance will appear here.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
