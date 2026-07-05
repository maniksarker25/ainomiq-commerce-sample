"use client";

import {
  CalendarClock,
  CheckCircle2,
  MessageCircle,
  Package,
  Pencil,
  Plus,
  RefreshCcw,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { MagicButton } from "../../_components/MagicButton";
import { CreativeOsCard } from "../../_components/CreativeOsCard";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea as ShadcnTextarea } from "@/components/ui/textarea";
import { Input as ShadcnInput } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  BriefFocusPanel,
  DueDateSelect,
  GridList,
  Input,
  Textarea,
} from "../../_components/FormFields";
import type { CreativeOsState, CreativeTask } from "../../types";
import { OUTPUT_FORMAT_OPTIONS } from "../../types";
import { catalogDisplayName, editorAssigneeValue } from "../../lib/products";
import { sourceGroupValue } from "../../lib/sources";
import { sourceStatusLabel } from "../../lib/sources";
import {
  optionsText,
  parseMultilineOptions,
  strategyContextLines,
} from "../../lib/strategy";
import {
  formatDate,
  nextWeekdayDate,
  normalizeFutureDueDate,
  WEEKDAY_OPTIONS,
} from "../../lib/dates";
import {
  outputCountLabel,
  taskChatRoomId,
  taskScheduleLabel,
  taskSourceLabel,
} from "../../lib/tasks";
import { BriefEditDialog } from "../shared/BriefEditDialog";
import { PostedBriefCard } from "../shared/PostedBriefCard";
import { SectionTitle } from "../shared/SectionTitle";
import { StrategyPicker } from "../shared/WorkspaceWidgets";
import type { PostBriefsTabProps } from "@/app/dashboard/creative-os/components/tabs/types";

function briefProgressForTask(state: CreativeOsState, task: CreativeTask) {
  const requestedCount = Math.max(1, Number(task.outputCount) || 1);
  const taskEdits = state.deliveredEdits.filter((edit) => edit.taskId === task.id);
  const editIds = new Set(taskEdits.map((edit) => edit.id));
  const approvedEditIds = new Set(
    state.launchItems
      .filter((item) => editIds.has(item.deliveredEditId))
      .map((item) => item.deliveredEditId),
  );
  const pendingReviewEditIds = new Set<string>();
  state.reviews.forEach((review) => {
    if (review.status !== "ready") return;
    if (editIds.has(review.deliveredEditId)) {
      pendingReviewEditIds.add(review.deliveredEditId);
    }
  });
  const approvedCount = state.launchItems.filter((item) =>
    editIds.has(item.deliveredEditId),
  ).length;
  const pendingReviewCount = [...pendingReviewEditIds].filter(
    (editId) => !approvedEditIds.has(editId),
  ).length;
  return {
    requestedCount,
    submittedCount: approvedCount + pendingReviewCount,
    approvedCount,
    notApprovedCount: pendingReviewCount,
    openCount: Math.max(0, requestedCount - approvedCount - pendingReviewCount),
  };
}

export function PostBriefsTab(props: PostBriefsTabProps) {
  const {
    sectionRefs,
    state,
    selectedProduct,
    taskDraft,
    setTaskDraft,
    productTaskSources,
    productTaskSelectionGroups,
    productSources,
    selectedTaskSource,
    selectedTaskSourceGroup,
    activeEditors,
    selectedEditorIds,
    setSelectedEditorIds,
    selectedEditorPermissions,
    canManageAccess,
    teamMemberLabel,
    optionalTeamText,
    selectedBriefPersonas,
    refreshBriefPersonas,
    briefPersonasRefreshing,
    selectedBriefAngles,
    refreshBriefAngles,
    briefAnglesRefreshing,
    selectedBriefHooks,
    refreshBriefHooks,
    briefHooksRefreshing,
    briefStyleOptions,
    selectedBriefStyles,
    applyBriefStrategyPick,
    setActiveSection,
    aiFillBriefDraft,
    briefAiStatus,
    briefAiReason,
    defaultAngle,
    defaultHook,
    taskError,
    postBriefDraft,
    briefCreateStatus,
    productBuildTasks,
    activeBriefTasks,
    briefScopeFilter,
    setBriefScopeFilter,
    briefScopeProducts,
    workspaceSources,
    productNameById,
    productFinishedTasks,
    productDeletedTasks,
    productEdits,
    briefEditDrafts,
    selectActiveProduct,
    openCatalogPicker,
    saveEditedBrief,
    cancelEditingBrief,
    updateBriefEditDraft,
    startEditingBrief,
    openChatRoom,
    closeTask,
    deleteTask,
    reopenTask,
    postponeTask,
    restoreTask,
    permanentlyDeleteTask,
    sourceDraftOptionExists,
    sourceLabelByDraftValue,
  } = props;

  const editingBriefId = Object.keys(briefEditDrafts)[0] ?? null;
  const editingBrief = editingBriefId
    ? ([...activeBriefTasks, ...productBuildTasks, ...productFinishedTasks].find(
        (task) => task.id === editingBriefId,
      ) ?? null)
    : null;
  const editingDraft = editingBriefId
    ? briefEditDrafts[editingBriefId]
    : null;

  return (
    <>
      <div
        ref={(el) => {
          sectionRefs.current.tasks = el;
        }}
        className="min-w-0 space-y-4"
      >
        <CreativeOsCard className="min-w-0">
          <CardContent className="min-w-0 space-y-4 p-3 sm:p-4 md:p-5">
            <SectionTitle
              title="Post Briefs"
              subtitle="Create clear ad briefs for editors. Pick source material, assign an editor, then post the brief."
            />
            <div className="min-w-0 w-full max-w-3xl">
              <div className="grid min-w-0 gap-3">
              <div className="min-w-0 space-y-1.5">
                <Label className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                  Product set
                </Label>
                {state.products.length ? (
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch">
                    <div className="min-w-0 w-full sm:flex-1">
                      <Select
                        value={selectedProduct.id}
                        onValueChange={selectActiveProduct}
                      >
                        <SelectTrigger className="min-h-12 w-full min-w-0 max-w-full">
                          <SelectValue placeholder="Select product set" />
                        </SelectTrigger>
                        <SelectContent>
                          {state.products.map((product, productIndex) => (
                            <SelectItem key={product.id} value={product.id}>
                              {catalogDisplayName(product, productIndex)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-12 w-full shrink-0 sm:w-auto"
                      onClick={openCatalogPicker}
                    >
                      <Package size={16} /> Add products
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-12 w-full"
                    onClick={openCatalogPicker}
                  >
                    <Package size={16} /> Choose products
                  </Button>
                )}
                <p className="break-words text-xs font-semibold text-muted-foreground">
                  Briefs use the selected product set and its Library sources.
                </p>
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                  Source material
                </Label>
                {productTaskSources.length ? (
                  <div className="min-w-0 w-full">
                    <Select
                      value={
                        taskDraft.sourceCreativeId ||
                        (selectedTaskSourceGroup
                          ? sourceGroupValue(selectedTaskSourceGroup.key)
                          : selectedTaskSource?.id || "")
                      }
                      onValueChange={(value) =>
                        setTaskDraft((current) => ({
                          ...current,
                          sourceCreativeId: value,
                        }))
                      }
                    >
                      <SelectTrigger className="min-h-12 w-full min-w-0 max-w-full">
                        <SelectValue placeholder="Select source material" />
                      </SelectTrigger>
                    <SelectContent>
                      {productTaskSelectionGroups.length ? (
                        <SelectGroup>
                          <SelectLabel>Folders / source pools</SelectLabel>
                          {productTaskSelectionGroups.map((group) => (
                            <SelectItem
                              key={group.key}
                              value={sourceGroupValue(group.key)}
                            >
                              {group.name} - full folder - {group.sources.length}{" "}
                              editable file
                              {group.sources.length === 1 ? "" : "s"}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ) : null}
                      <SelectGroup>
                        <SelectLabel>Single files</SelectLabel>
                        {productTaskSources.map((source) => (
                          <SelectItem key={source.id} value={source.id}>
                            {source.name} - single file -{" "}
                            {sourceStatusLabel(source)} -{" "}
                            {source.derivativeCount}/{source.derivativeCap}{" "}
                            approved
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                    </Select>
                  </div>
                ) : productSources.length ? (
                  <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                    <AlertDescription>
                      All saved sources are maxed out or marked do not use. Add
                      a new source first.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <AlertDescription>
                      Add source material to the Ainomiq Library before posting
                      briefs.
                    </AlertDescription>
                  </Alert>
                )}
                <p className="break-words text-xs font-semibold text-muted-foreground">
                  Only editable sources show here. When a source reaches its cap, it moves to Used and leaves this picker.
                </p>
              </div>
              <Input
                label="Brief name"
                value={taskDraft.briefName}
                onChange={(event) =>
                  setTaskDraft((current) => ({
                    ...current,
                    briefName: event.target.value,
                  }))
                }
                placeholder="Example: Waist gap VSL - Sunday batch"
              />
              <div className="min-w-0 space-y-1.5">
                <Label className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                  Assign to editor
                </Label>
                {activeEditors.length ? (
                  <Card className="min-w-0 py-4 shadow-none">
                    <CardContent className="min-w-0 space-y-3 px-3 sm:px-4">
                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0 text-sm font-semibold text-foreground">
                          {selectedEditorPermissions.length
                            ? `${selectedEditorPermissions.length} selected`
                            : "No editor selected"}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              setSelectedEditorIds(
                                activeEditors.map(
                                  (permission) => permission.id,
                                ),
                              )
                            }
                          >
                            Select all
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedEditorIds([])}
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {activeEditors.map((permission) => {
                          const selected = selectedEditorIds.includes(
                            permission.id,
                          );
                          return (
                            <div
                              key={permission.id}
                              role="button"
                              tabIndex={0}
                              onClick={() =>
                                setSelectedEditorIds((current) =>
                                  current.includes(permission.id)
                                    ? current.filter(
                                        (id) => id !== permission.id,
                                      )
                                    : [...current, permission.id],
                                )
                              }
                              onKeyDown={(event) => {
                                if (
                                  event.key !== "Enter" &&
                                  event.key !== " "
                                ) {
                                  return;
                                }
                                event.preventDefault();
                                setSelectedEditorIds((current) =>
                                  current.includes(permission.id)
                                    ? current.filter(
                                        (id) => id !== permission.id,
                                      )
                                    : [...current, permission.id],
                                );
                              }}
                              className={cn(
                                "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                                selected
                                  ? "border-primary/25 bg-muted/40 text-foreground"
                                  : "border-border bg-background text-foreground hover:bg-muted/40",
                              )}
                            >
                              <Checkbox
                                checked={selected}
                                className="pointer-events-none"
                                tabIndex={-1}
                                aria-hidden
                              />
                              <span className="min-w-0">
                                <span className="block truncate">
                                  {permission.email || permission.userName}
                                </span>
                                <span className="block text-xs font-medium text-muted-foreground">
                                  {permission.role}
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ) : canManageAccess ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-12 w-full"
                    onClick={() => setActiveSection("access")}
                  >
                    <Users size={16} /> {teamMemberLabel}
                  </Button>
                ) : (
                  <Alert>
                    <AlertDescription>
                      No editors yet. Ask the workspace owner to invite one.
                    </AlertDescription>
                  </Alert>
                )}
                <p className="text-xs font-semibold text-muted-foreground">
                  {selectedEditorPermissions.length > 1
                    ? "Creating this brief will create one assigned task per selected editor."
                    : optionalTeamText}
                </p>
              </div>
              <StrategyPicker
                personas={selectedProduct.personas}
                selectedPersonas={selectedBriefPersonas}
                onPick={applyBriefStrategyPick}
                onEditCatalog={() => setActiveSection("setup")}
                onRefreshPersonas={refreshBriefPersonas}
                personasRefreshing={briefPersonasRefreshing}
                angles={selectedProduct.sellingPoints}
                selectedAngles={selectedBriefAngles}
                onRefreshAngles={refreshBriefAngles}
                anglesRefreshing={briefAnglesRefreshing}
                hooks={selectedProduct.pains}
                selectedHooks={selectedBriefHooks}
                onRefreshHooks={refreshBriefHooks}
                hooksRefreshing={briefHooksRefreshing}
                styles={briefStyleOptions}
                selectedStyles={selectedBriefStyles}
              />
              <Accordion
                type="single"
                collapsible
                className="min-w-0 w-full overflow-hidden rounded-xl border border-border/60 bg-background"
              >
                <AccordionItem value="brief-content" className="border-0 px-3 sm:px-4">
                  <div className="flex min-w-0 flex-col gap-2 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <AccordionTrigger className="min-w-0 flex-1 py-2 hover:no-underline">
                      <span className="text-left">
                        <span className="block text-sm font-bold text-foreground">
                          Brief content
                        </span>
                        <span className="mt-0.5 block text-xs font-semibold text-muted-foreground">
                          Angles, hooks and editor notes.
                        </span>
                      </span>
                    </AccordionTrigger>
                    <MagicButton
                      size="sm"
                      className="w-full shrink-0 sm:w-auto"
                      loading={briefAiStatus === "filling"}
                      onClick={(event) => {
                        event.stopPropagation();
                        aiFillBriefDraft();
                      }}
                    >
                      {briefAiStatus === "filling"
                        ? "Magic filling..."
                        : briefAiStatus === "filled"
                          ? "Magic filled"
                          : "Magic Fill"}
                    </MagicButton>
                  </div>
                  {briefAiReason ? (
                    <p className="pb-2 text-xs font-semibold text-muted-foreground">
                      {briefAiReason}
                    </p>
                  ) : null}
                  <AccordionContent className="min-w-0 space-y-3 border-t border-border/60 pb-4 pt-4">
                    <div className="grid min-w-0 gap-3 md:grid-cols-3">
                    <Textarea
                      label="Angles"
                      value={taskDraft.angles}
                      onChange={(event) =>
                        setTaskDraft((current) => ({
                          ...current,
                          angles: event.target.value,
                          angle:
                            parseMultilineOptions(
                              event.target.value,
                              current.angle || defaultAngle,
                              1,
                            )[0] || current.angle,
                        }))
                      }
                    />
                    <Textarea
                      label="Hooks"
                      value={taskDraft.hooks}
                      onChange={(event) =>
                        setTaskDraft((current) => ({
                          ...current,
                          hooks: event.target.value,
                          hook:
                            parseMultilineOptions(
                              event.target.value,
                              current.hook || defaultHook,
                              1,
                            )[0] || current.hook,
                        }))
                      }
                    />
                    <Textarea
                      label="Styles"
                      value={taskDraft.format}
                      onChange={(event) =>
                        setTaskDraft((current) => ({
                          ...current,
                          format: event.target.value,
                        }))
                      }
                      placeholder="Pick styles above, or one per line"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                      Extra notes
                    </Label>
                    <ShadcnTextarea
                      value={taskDraft.notes}
                      onChange={(event) =>
                        setTaskDraft((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      placeholder="Extra production direction, claim boundaries, edit notes, creator guidance or anything the editor should know."
                      rows={5}
                      className="min-h-28 w-full min-w-0"
                    />
                  </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              <div className="min-w-0 space-y-3 rounded-xl border border-border/60 bg-muted/30 p-3">
                <div className="text-sm font-bold text-foreground">Outputs</div>
                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  {(
                    [
                      {
                        label: "Videos",
                        countKey: "videoCount",
                        formatKey: "videoFormat",
                      },
                      {
                        label: "Photos",
                        countKey: "photoCount",
                        formatKey: "photoFormat",
                      },
                    ] as const
                  ).map((row) => (
                    <div key={row.countKey} className="min-w-0 space-y-1.5">
                      <Label className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                        {row.label}
                      </Label>
                      <div className="flex min-w-0 gap-2">
                        <ShadcnInput
                          type="number"
                          min={0}
                          value={taskDraft[row.countKey]}
                          onChange={(event) =>
                            setTaskDraft((current) => ({
                              ...current,
                              [row.countKey]: event.target.value,
                            }))
                          }
                          placeholder="0"
                          className="h-10 w-20 shrink-0"
                        />
                        <Select
                          value={taskDraft[row.formatKey]}
                          onValueChange={(value) =>
                            setTaskDraft((current) => ({
                              ...current,
                              [row.formatKey]: value,
                            }))
                          }
                        >
                          <SelectTrigger className="h-10 min-w-0 flex-1">
                            <SelectValue placeholder="Format" />
                          </SelectTrigger>
                          <SelectContent>
                            {OUTPUT_FORMAT_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-xs font-semibold text-muted-foreground">
                  Total outputs
                  {taskDraft.scheduleType === "returning" ? " per week" : ""}:{" "}
                  <span className="font-bold text-foreground">
                    {(Number(taskDraft.videoCount) || 0) +
                      (Number(taskDraft.photoCount) || 0)}
                  </span>
                </div>
              </div>
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                    Schedule
                  </Label>
                  <Select
                    value={taskDraft.scheduleType}
                    onValueChange={(value) => {
                      const scheduleType = value as "one-time" | "returning";
                      setTaskDraft((current) => ({
                        ...current,
                        scheduleType,
                        dueDate:
                          scheduleType === "returning"
                            ? current.dueDate ||
                              nextWeekdayDate(current.recurrenceDay)
                            : current.dueDate,
                      }));
                    }}
                  >
                    <SelectTrigger className="min-h-12 w-full min-w-0 max-w-full">
                      <SelectValue placeholder="Select schedule" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one-time">One-time brief</SelectItem>
                      <SelectItem value="returning">Returning brief</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {taskDraft.scheduleType === "returning" ? (
                  <div className="min-w-0 space-y-1.5">
                    <Label className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                      Delivery day
                    </Label>
                    <Select
                      value={taskDraft.recurrenceDay}
                      onValueChange={(value) =>
                        setTaskDraft((current) => ({
                          ...current,
                          recurrenceDay: value,
                          dueDate: nextWeekdayDate(value),
                        }))
                      }
                    >
                      <SelectTrigger className="min-h-12 w-full min-w-0 max-w-full">
                        <SelectValue placeholder="Select delivery day" />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEKDAY_OPTIONS.map((day) => (
                          <SelectItem key={day.value} value={day.value}>
                            Every {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <DueDateSelect
                    value={taskDraft.dueDate}
                    onChange={(value) =>
                      setTaskDraft((current) => ({
                        ...current,
                        dueDate: value,
                      }))
                    }
                  />
                )}
              </div>
              {taskError ? (
                <Alert variant="destructive">
                  <AlertDescription>{taskError}</AlertDescription>
                </Alert>
              ) : null}
              <BriefFocusPanel
                angles={parseMultilineOptions(
                  taskDraft.angles,
                  "",
                  8,
                ).filter(Boolean)}
                hooks={parseMultilineOptions(taskDraft.hooks, "", 8).filter(
                  Boolean,
                )}
                context={strategyContextLines(taskDraft.notes)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={postBriefDraft}
                  disabled={briefCreateStatus === "creating"}
                >
                  <Plus size={16} />
                  {briefCreateStatus === "creating"
                    ? "Posting..."
                    : "Post brief"}
                </Button>
              </div>
              </div>
            </div>
          </CardContent>
        </CreativeOsCard>
        <div className="min-w-0 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
              Active briefs across all products
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <Label className="shrink-0 text-xs font-semibold text-muted-foreground">
                Filter
              </Label>
              <Select
                value={briefScopeFilter}
                onValueChange={setBriefScopeFilter}
              >
                <SelectTrigger className="h-9 w-full min-w-0 sm:w-64">
                  <SelectValue placeholder="All products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All products</SelectItem>
                  {briefScopeProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <GridList
            title="Posted briefs"
            subtitle="Every active brief across your products. Source caps are consumed only after approval."
            emptyText="No active briefs yet. Create a brief above or check Review Ads for delivered work."
            layout="full"
            items={activeBriefTasks.map((task) => {
              const source = workspaceSources.find(
                (item) => item.id === task.sourceCreativeId,
              );
              const isOtherProduct = task.productId !== selectedProduct.id;
              return (
                <PostedBriefCard
                  key={task.id}
                  task={task}
                  source={source}
                  productName={productNameById.get(task.productId)}
                  progress={briefProgressForTask(state, task)}
                  onEdit={() => {
                    if (isOtherProduct) selectActiveProduct(task.productId);
                    startEditingBrief(task);
                  }}
                  onOpenChat={() => openChatRoom(taskChatRoomId(task))}
                  onClose={() => closeTask(task.id)}
                  onDelete={() => deleteTask(task.id)}
                />
              );
            })}
          />
        </div>
        <BriefEditDialog
          open={Boolean(editingBrief && editingDraft)}
          task={editingBrief || null}
          editDraft={editingDraft}
          activeEditors={activeEditors}
          productTaskSelectionGroups={productTaskSelectionGroups}
          productTaskSources={productTaskSources}
          sourceDraftOptionExists={sourceDraftOptionExists}
          sourceLabelByDraftValue={sourceLabelByDraftValue}
          onOpenChange={(open) => {
            if (!open && editingBriefId) cancelEditingBrief(editingBriefId);
          }}
          onSave={() => {
            if (editingBriefId) saveEditedBrief(editingBriefId);
          }}
          onCancel={() => {
            if (editingBriefId) cancelEditingBrief(editingBriefId);
          }}
          onUpdateDraft={(patch) => {
            if (editingBriefId) updateBriefEditDraft(editingBriefId, patch);
          }}
          taskError={editingBriefId ? taskError : ""}
        />
        {productFinishedTasks.length || productDeletedTasks.length ? (
          <GridList
            title="Finished / Deleted briefs"
            subtitle="Finished briefs stay visible for history. Deleted briefs can be restored or permanently removed."
            emptyText="No finished or deleted briefs."
            layout="full"
            items={[
              ...productFinishedTasks.map((task) => {
                const source = productSources.find(
                  (item) => item.id === task.sourceCreativeId,
                );
                const taskEdits = productEdits.filter(
                  (edit) => edit.taskId === task.id,
                );
                const latestDeliveredAt =
                  taskEdits
                    .map((edit) => edit.deliveredAt)
                    .sort()
                    .at(-1) || "";
                return (
                  <Card
                    key={task.id}
                    className="border-emerald-200/80 shadow-none ring-emerald-100"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center min-w-0 gap-2">
                        <div
                          className="min-w-0 text-sm font-semibold truncate text-foreground"
                          title={task.brief}
                        >
                          {task.brief}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={() => startEditingBrief(task)}
                          aria-label={`Edit finished brief ${task.brief}`}
                          title="Edit brief"
                        >
                          <Pencil size={13} />
                        </Button>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {task.assignee} - finished{" "}
                          {formatDate(latestDeliveredAt || task.dueDate)}
                        </div>
                      </div>
                      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                        finished
                      </Badge>
                    </div>
                    <div className="grid gap-2 mt-3 text-sm text-muted-foreground">
                      <div>
                        <strong>Library:</strong>{" "}
                        {taskSourceLabel(task, source)}
                      </div>
                      <div>
                        <strong>Delivered work:</strong>{" "}
                        {taskEdits.length || 0} file
                        {taskEdits.length === 1 ? "" : "s"}
                      </div>
                      <div className="whitespace-pre-line">
                        <strong>Angles:</strong>{" "}
                        {optionsText(task.angles, task.angle)}
                      </div>
                      <div className="whitespace-pre-line">
                        <strong>Hooks:</strong>{" "}
                        {optionsText(task.hooks, task.hook)}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => openChatRoom(taskChatRoomId(task))}
                      >
                        <MessageCircle size={15} /> Open chat
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => reopenTask(task.id)}
                        aria-label={`Reopen finished brief ${task.brief}`}
                      >
                        <RefreshCcw size={15} /> Reopen
                      </Button>
                      {task.scheduleType !== "returning" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => postponeTask(task.id, 3)}
                          aria-label={`Postpone finished brief ${task.brief} by 3 days`}
                        >
                          <CalendarClock size={15} /> Postpone 3 days
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteTask(task.id)}
                        aria-label={`Delete finished brief ${task.brief}`}
                      >
                        <Trash2 size={15} /> Delete
                      </Button>
                    </div>
                    </CardContent>
                  </Card>
                );
              }),
              ...productDeletedTasks.map((task) => (
                <Card key={task.id} className="opacity-90 shadow-none">
                  <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div
                        className="text-sm font-semibold truncate text-foreground"
                        title={task.brief}
                      >
                        {task.brief}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {task.assignee} - deleted{" "}
                        {formatDate(task.deletedAt || "")}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="secondary">deleted</Badge>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon-sm"
                        onClick={() => permanentlyDeleteTask(task.id)}
                        aria-label={`Permanently delete brief ${task.brief}`}
                        title="Permanently delete brief"
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2 mt-3 text-sm text-muted-foreground">
                    <div>
                      <strong>Library:</strong>{" "}
                      {taskSourceLabel(
                        task,
                        productSources.find(
                          (item) => item.id === task.sourceCreativeId,
                        ),
                      )}
                    </div>
                    <div className="whitespace-pre-line">
                      <strong>Angles:</strong>{" "}
                      {optionsText(task.angles, task.angle)}
                    </div>
                    <div className="whitespace-pre-line">
                      <strong>Hooks:</strong>{" "}
                      {optionsText(task.hooks, task.hook)}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => restoreTask(task.id)}
                    >
                      <RefreshCcw size={15} /> Restore brief
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        restoreTask(task.id);
                        startEditingBrief({
                          ...task,
                          status: "assigned",
                          deletedAt: undefined,
                        });
                      }}
                    >
                      <Pencil size={15} /> Restore and edit
                    </Button>
                  </div>
                  </CardContent>
                </Card>
              )),
            ]}
          />
        ) : null}
      </div>
    </>
  );
}
