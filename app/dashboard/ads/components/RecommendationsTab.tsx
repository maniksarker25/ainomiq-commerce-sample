"use client";

import { ChevronDown } from "lucide-react";
import type { CampaignInsights } from "../types";
import type { LogicActionCard, LogicActionGroup } from "../lib/logic-actions";
import { formatCurrency } from "../utils";
import { MetricCard, Panel } from "./CoreUI";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  severityActionButtonClass,
  severityActionTextClass,
  severityBadgeClass,
  severityCardClass,
  severityDotClass,
} from "../_components/severity-styles";

type RecommendationsTabProps = {
  logicActionCards: LogicActionCard[];
  campaignInsights: CampaignInsights | null;
  campaignDateLabel: string;
  visibleLogicActionCards: LogicActionCard[];
  logicActionGroups: LogicActionGroup[];
  expandedLogicActionGroups: Set<string>;
  dismissedLogicActionIds: Set<string>;
  dismissedLogicActionCount: number;
  showDismissedLogicActions: boolean;
  onToggleShowDismissed: () => void;
  onRestoreDismissed: () => void;
  onToggleGroup: (groupId: string) => void;
  onDismissAction: (actionId: string) => void;
  onTakeAction: (prompt: string) => void;
};

export default function RecommendationsTab({
  logicActionCards,
  campaignInsights,
  campaignDateLabel,
  visibleLogicActionCards,
  logicActionGroups,
  expandedLogicActionGroups,
  dismissedLogicActionIds,
  dismissedLogicActionCount,
  showDismissedLogicActions,
  onToggleShowDismissed,
  onRestoreDismissed,
  onToggleGroup,
  onDismissAction,
  onTakeAction,
}: RecommendationsTabProps) {
  return (
    <Panel title="Logic Ads actions">
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <MetricCard
          label="Critical"
          value={logicActionCards.filter((c) => c.severity === "critical").length}
        />
        <MetricCard
          label="Warnings"
          value={logicActionCards.filter((c) => c.severity === "warning").length}
        />
        <MetricCard
          label="Scale signals"
          value={logicActionCards.filter((c) => c.severity === "success").length}
        />
        <MetricCard
          label="Spend analyzed"
          value={formatCurrency(campaignInsights?.totalSpend || 0)}
        />
      </div>

      <Alert className="mb-4 border-primary/20 bg-primary/5">
        <AlertDescription className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">
              Daily live action queue
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Built from fresh Meta signals for {campaignDateLabel.toLowerCase()}.
              Dismissed actions stay hidden only for today.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {dismissedLogicActionCount ? (
              <>
                <Button variant="outline" size="sm" onClick={onToggleShowDismissed}>
                  {showDismissedLogicActions
                    ? "Hide dismissed"
                    : `Show ${dismissedLogicActionCount} dismissed`}
                </Button>
                <Button variant="outline" size="sm" onClick={onRestoreDismissed}>
                  Restore today
                </Button>
              </>
            ) : null}
          </div>
        </AlertDescription>
      </Alert>

      <div className="grid gap-3">
        {visibleLogicActionCards.length ? (
          logicActionGroups.map((group) => {
            const expanded = expandedLogicActionGroups.has(group.id);
            const primary = group.cards[0];
            const criticalCount = group.cards.filter(
              (c) => c.severity === "critical",
            ).length;
            const warningCount = group.cards.filter(
              (c) => c.severity === "warning",
            ).length;
            const scaleCount = group.cards.filter(
              (c) => c.severity === "success",
            ).length;

            return (
              <Card key={group.id} className="gap-0 overflow-hidden py-0">
                <button
                  type="button"
                  onClick={() => onToggleGroup(group.id)}
                  className="flex w-full flex-col gap-3 p-4 text-left transition hover:bg-muted/40 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={severityDotClass(group.severity)} />
                      <span className="text-sm font-semibold text-foreground">
                        {group.title}
                      </span>
                      <Badge variant="secondary">
                        {group.cards.length} action
                        {group.cards.length === 1 ? "" : "s"}
                      </Badge>
                      {criticalCount ? (
                        <Badge variant="destructive">{criticalCount} critical</Badge>
                      ) : null}
                      {warningCount ? (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                          {warningCount} warning{warningCount === 1 ? "" : "s"}
                        </Badge>
                      ) : null}
                      {scaleCount ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                          {scaleCount} scale
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {group.summary}
                    </p>
                    {primary ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Top signal: {primary.title} - {primary.metric}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-sm font-medium text-muted-foreground">
                    <span>{expanded ? "Collapse" : "Open"}</span>
                    <ChevronDown
                      className={cn(
                        "size-4 transition",
                        expanded && "rotate-180",
                      )}
                    />
                  </div>
                </button>

                {expanded ? (
                  <CardContent className="grid gap-3 border-t bg-muted/20 p-3 pt-3">
                    {group.cards.map((card) => {
                      const dismissed = dismissedLogicActionIds.has(card.id);
                      return (
                        <article
                          key={card.id}
                          className={cn(
                            severityCardClass(card.severity),
                            dismissed && "opacity-55",
                          )}
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={severityDotClass(card.severity)} />
                                <span className={severityBadgeClass(card.severity)}>
                                  {card.category}
                                </span>
                                <div className="font-semibold text-foreground">
                                  {card.title}
                                </div>
                                {dismissed ? (
                                  <Badge variant="outline">Dismissed today</Badge>
                                ) : null}
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {card.detail}
                              </p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                {card.evidence}
                              </p>
                            </div>
                            <div className="shrink-0 text-left md:text-right">
                              <div className="text-sm font-semibold text-foreground">
                                {card.metric}
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2 md:justify-end">
                                <Button
                                  size="sm"
                                  className={severityActionButtonClass(card.severity)}
                                  onClick={() =>
                                    onTakeAction(card.prompt || card.title)
                                  }
                                >
                                  Take action
                                </Button>
                                {!dismissed ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onDismissAction(card.id)}
                                  >
                                    Dismiss today
                                  </Button>
                                ) : null}
                              </div>
                              <div
                                className={cn(
                                  "mt-2",
                                  severityActionTextClass(card.severity),
                                )}
                              >
                                {card.action}
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </CardContent>
                ) : null}
              </Card>
            );
          })
        ) : (
          <Card className="border-dashed shadow-none">
            <CardContent className="py-10 text-center">
              <div className="text-lg font-semibold text-foreground">
                All live actions are cleared for today
              </div>
              <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
                New actions will appear automatically when today&apos;s Meta
                signals change or tomorrow&apos;s queue refreshes. You can restore
                dismissed actions for this date range anytime.
              </p>
              {dismissedLogicActionCount ? (
                <Button className="mt-4" onClick={onRestoreDismissed}>
                  Restore dismissed actions
                </Button>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
    </Panel>
  );
}
