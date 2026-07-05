"use client";

import React, { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChatMessage,
  Draft,
  ProductCatalogItem,
  SavedTemplate,
} from "../_lib/types";
import { cleanDisplayText, hasFinalImage } from "../_lib/utils";
import {
  Send,
  PlusCircle,
  Sparkles,
  Cloud,
  CloudOff,
  Loader2,
  HelpCircle,
  Trash2,
} from "lucide-react";

export type StudioSyncStatus = "idle" | "saving" | "saved" | "error";

function ThinkingStatus({ label }: { label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-[13px] text-gray-500">
      <div className="flex shrink-0 gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400" />
      </div>
      <span className="min-w-0 wrap-break-word">{label}</span>
    </div>
  );
}

interface Props {
  chat: ChatMessage[];
  agentInput: string;
  generating: boolean;
  generatingPhase?: string;
  nextActions: string[];
  productForGeneration: ProductCatalogItem | null;
  onInputChange: (val: string) => void;
  onSendMessage: (msg?: string) => void;
  onResetChat: () => void;
  onSelectDraft: (id: string) => void;
  onSetActiveMenu: (menu: any) => void;
  onSetTemplateFeedback: (feedback: string) => void;
  onAnswerClarification?: (answer: string) => void;
  drafts: Draft[];
  draftsCount: number;
  productCatalog: ProductCatalogItem[];
  product: string;
  setProduct: (val: string) => void;
  productCount: number;
  estimatedChatNomi: number;
  estimatedImageNomi: number;
  selectedModelLabel?: string;
  studioSyncStatus?: StudioSyncStatus;
  onGenerateVisual: (draftId: string) => void;
  onUpdateVisualPrompt: (draftId: string, nextPrompt: string) => void;
  generatingVisualDraftIds: string[];
  onSaveTemplate?: (draft: Draft, index: number) => void;
  savedTemplates?: SavedTemplate[];
}

export function ChatInterface({
  chat,
  agentInput,
  generating,
  generatingPhase = "",
  nextActions,
  productForGeneration,
  onInputChange,
  onSendMessage,
  onResetChat,
  onSelectDraft,
  onSetActiveMenu,
  onSetTemplateFeedback,
  onAnswerClarification,
  drafts = [],
  draftsCount,
  productCatalog,
  product,
  setProduct,
  productCount,
  estimatedChatNomi,
  estimatedImageNomi,
  selectedModelLabel,
  studioSyncStatus = "idle",
  onGenerateVisual,
  onUpdateVisualPrompt,
  generatingVisualDraftIds = [],
  onSaveTemplate,
  savedTemplates = [],
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const totalEstimatedNomi = estimatedChatNomi + estimatedImageNomi;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat, generating, generatingPhase]);

  function resizeComposer() {
    const node = composerRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
  }

  useEffect(() => {
    resizeComposer();
  }, [agentInput]);

  const syncLabel =
    studioSyncStatus === "saving"
      ? "Saving…"
      : studioSyncStatus === "saved"
        ? "Cloud synced"
        : studioSyncStatus === "error"
          ? "Sync paused"
          : null;

  function renderInlineDraft(draftId?: string) {
    if (!draftId) return null;
    const safeDrafts = Array.isArray(drafts) ? drafts : [];
    const draftIndex = safeDrafts.findIndex((item) => item.id === draftId);
    if (draftIndex < 0) return null;
    const draft = safeDrafts[draftIndex];

    const draftHasImage = hasFinalImage(draft);
    const isSaved =
      Array.isArray(savedTemplates) &&
      savedTemplates.some(
        (t) => t.id === (draft.templateId || `auto-${draft.id}`),
      );

    return (
      <div className="mt-3 w-full min-w-0 space-y-3 rounded-2xl border border-gray-150 bg-white/95 p-3 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.12)] sm:p-4 animate-in fade-in duration-200">
        <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">
              Draft Layout Generated
            </p>
            <p className="mt-0.5 wrap-break-word text-sm font-bold leading-tight text-gray-900">
              {draft.title}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {isSaved && (
              <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                In Library
              </span>
            )}
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                draftHasImage
                  ? "bg-blue-50 text-blue-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {draftHasImage ? "Visual ready" : "Visual pending"}
            </span>
          </div>
        </div>

        <div className="relative overflow-hidden border border-gray-100 rounded-xl bg-gray-50 h-32 flex items-center justify-center">
          {draftHasImage && draft.imageUrl ? (
            <img
              src={draft.imageUrl}
              alt="Generated draft visual"
              className="absolute inset-0 object-contain w-full h-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="text-center px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Template design frame
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => {
              onSelectDraft(draft.id);
              onSetActiveMenu("drafts");
            }}
            variant="outline"
            className="flex-1 h-9 text-xs font-semibold rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Customize
          </Button>

          {onSaveTemplate && (
            <Button
              type="button"
              disabled={isSaved}
              onClick={() => onSaveTemplate(draft, draftIndex)}
              className={`flex-1 h-9 text-xs font-semibold rounded-xl text-white transition-all ${
                isSaved
                  ? "bg-emerald-600 hover:bg-emerald-600 opacity-90 cursor-default"
                  : "bg-blue-600 hover:bg-blue-700 shadow-sm"
              }`}
            >
              {isSaved ? "Saved to Library" : "Save to Templates"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden">
      <Card className="flex h-full w-full min-w-0 max-w-full flex-col gap-0 overflow-hidden rounded-[20px] border-blue-100 py-0 shadow-sm sm:rounded-[28px]">
        <CardHeader className="flex w-full min-w-0 flex-col gap-3 overflow-hidden border-b border-gray-50 p-4 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:p-6">
          <div className="min-w-0">
            <CardTitle className="text-lg font-bold text-gray-950 sm:text-xl">
              Content Agent
            </CardTitle>
            <CardDescription className="text-sm text-gray-600">
              Ask for product posts, carousels, or reusable templates.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
            {syncLabel ? (
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                  studioSyncStatus === "saved"
                    ? "text-emerald-700 bg-emerald-50"
                    : studioSyncStatus === "saving"
                      ? "text-gray-600 bg-gray-100"
                      : "text-amber-700 bg-amber-50"
                }`}
              >
                {studioSyncStatus === "saving" ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : studioSyncStatus === "saved" ? (
                  <Cloud className="w-3 h-3" />
                ) : (
                  <CloudOff className="w-3 h-3" />
                )}
                {syncLabel}
              </span>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={onResetChat}
              className="h-8 px-2 text-xs font-bold rounded-full sm:px-3"
              title="Start a new chat"
            >
              <PlusCircle className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">New chat</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onResetChat}
              className="h-8 px-2 text-xs font-bold text-red-600 border-red-200 rounded-full hover:bg-red-50 sm:px-3"
              title="Clear chat"
            >
              <Trash2 className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Clear chat</span>
            </Button>
            <Badge className="hidden h-6 bg-blue-50 text-[10px] font-bold text-blue-700 border-blue-100 sm:inline-flex">
              Brand + Catalog Active
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-50/30 p-0">
          <div
            ref={scrollRef}
            className="min-h-0 w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-x-contain px-3 py-3 sm:px-6 sm:py-4"
          >
            <div className="w-full min-w-0 space-y-4 pb-4">
              {chat.map((item, index) => (
                <div
                  key={`${item.role}-${index}`}
                  className={`flex w-full min-w-0 ${item.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {item.needsClarification &&
                  item.clarificationQuestions?.length ? (
                    <div className="w-full max-w-full rounded-2xl border border-amber-200/80 bg-amber-50/90 px-3 py-3 shadow-sm sm:max-w-[92%] sm:px-4 sm:py-4">
                      <div className="flex items-start gap-2 mb-3">
                        <HelpCircle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[13px] font-bold text-amber-950">
                            Input needed
                          </p>
                          <p className="text-[12px] text-amber-900/80 mt-0.5">
                            Answer these so I can generate the right output.
                          </p>
                        </div>
                      </div>
                      <ol className="mb-4 list-inside list-decimal space-y-2 wrap-break-word text-[13px] text-amber-950/90 ">
                        {item.clarificationQuestions.map((q, qIndex) => (
                          <li key={qIndex} className="pl-1 leading-relaxed">
                            {cleanDisplayText(q)}
                          </li>
                        ))}
                      </ol>
                      <div className="flex flex-wrap gap-2">
                        {item.clarificationQuestions.map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => onAnswerClarification?.(q)}
                            disabled={generating}
                            className="max-w-full px-3 py-1.5 text-left text-[11px] font-semibold wrap-break-word rounded-full border border-amber-200 bg-white text-amber-900 transition-colors hover:bg-amber-100/80 disabled:opacity-50"
                          >
                            Reply to: {cleanDisplayText(q).slice(0, 42)}
                            {q.length > 42 ? "…" : ""}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`min-w-0 w-fit max-w-[92%] rounded-2xl px-3 py-2.5 text-[13px] leading-relaxed wrap-break-word  shadow-sm sm:max-w-[85%] sm:px-4 sm:py-3 sm:text-[14px] ${
                        item.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-800 border border-gray-100"
                      } ${item.streaming ? "ring-1 ring-blue-100" : ""}`}
                    >
                      {item.streaming && !item.text.trim() ? (
                        <ThinkingStatus
                          label={
                            generatingPhase === "images"
                              ? "Generating visuals…"
                              : "Thinking with Brand Data…"
                          }
                        />
                      ) : (
                        <>
                          {cleanDisplayText(item.text)}
                          {item.streaming ? (
                            generatingPhase === "images" && item.text.trim() ? (
                              <div className="pt-2 mt-2 border-t border-gray-100">
                                <ThinkingStatus label="Generating visuals…" />
                              </div>
                            ) : (
                              <span className="inline-block w-0.5 h-4 ml-0.5 bg-blue-400 animate-pulse align-middle" />
                            )
                          ) : null}
                        </>
                      )}
                      {item.action && !item.streaming ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => {
                              if (item.action?.draftId)
                                onSelectDraft(item.action.draftId);
                              onSetActiveMenu("drafts");
                            }}
                            className="w-full mt-3 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl h-9"
                          >
                            {item.action.label}
                          </Button>
                          {renderInlineDraft(item.action.draftId)}
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
              {generating && !chat.some((m) => m.streaming) ? (
                <div className="flex justify-start">
                  <div className="px-4 py-3 bg-white border border-gray-100 shadow-sm rounded-2xl">
                    <ThinkingStatus
                      label={
                        generatingPhase === "images"
                          ? "Generating visuals…"
                          : "Thinking with Brand Data…"
                      }
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {nextActions.length > 0 ? (
            <div className="z-10 min-w-0 max-w-full shrink-0 overflow-hidden border-t border-gray-100/60 bg-white/60 px-3 py-3 backdrop-blur-md sm:px-4">
              <div
                className="flex max-w-full gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ msOverflowStyle: "none", scrollbarWidth: "none" }}
              >
                {nextActions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => {
                      if (
                        action === "Improve my current templates" &&
                        draftsCount > 0
                      ) {
                        onSetActiveMenu("drafts");
                        onSetTemplateFeedback(
                          "Make the templates cleaner, better aligned, and more premium",
                        );
                      } else {
                        onSendMessage(
                          action === "Make 3 product posts from my catalog"
                            ? `Create 3 ready-to-use Instagram product posts using ${productForGeneration?.title || "the best products from my catalog"}. Use product images where available.`
                            : action,
                        );
                      }
                    }}
                    className="px-4 py-2 text-[12px] whitespace-nowrap text-blue-700 transition-all border border-blue-100/80 rounded-full bg-blue-50/50 hover:bg-blue-100 font-bold shadow-sm shrink-0"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="z-20 w-full min-w-0 max-w-full shrink-0 overflow-hidden border-t border-gray-100 bg-white p-3 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] sm:p-4">
            <div className="flex flex-col gap-2 px-1 mb-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Active Product Context:
                </span>
                {productCatalog.length ? (
                  <select
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    className="h-8 w-full min-w-0 max-w-full cursor-pointer truncate rounded-lg border-none bg-blue-50 px-3 text-xs font-bold text-blue-700 outline-none transition-colors hover:bg-blue-100 focus:ring-2 focus:ring-blue-500 sm:max-w-[220px]"
                  >
                    <option value="">✨ Let AI Choose Automatically</option>
                    {productCatalog.map((item) => (
                      <option key={item.title} value={item.title}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    placeholder="Target product..."
                    className="h-8 w-full min-w-0 rounded-lg border-gray-200 text-xs font-bold sm:max-w-[220px]"
                  />
                )}
              </div>
              <Badge className="bg-green-50 text-green-700 text-[10px] border-none font-bold uppercase tracking-wider hidden sm:inline-flex px-2 py-0.5 rounded-full">
                {productCount} Synced
              </Badge>
            </div>

            <div className="mb-2 flex flex-col gap-1.5 px-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <p className="min-w-0 text-[11px] leading-snug text-gray-500">
                <Sparkles className="w-3 h-3 inline mr-1 text-blue-500 -mt-0.5" />
                Send uses{" "}
                <span className="font-bold text-gray-700">
                  {totalEstimatedNomi} Nomi&apos;s
                </span>
                {estimatedImageNomi > 0 && selectedModelLabel ? (
                  <span className="text-gray-400">
                    {" "}
                    · images via {selectedModelLabel}
                  </span>
                ) : null}
              </p>
              <span className="hidden shrink-0 items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-gray-600 sm:inline-flex">
                Shift + Enter for new line
              </span>
            </div>

            <div className="flex min-w-0 items-end gap-2">
              <div className="min-w-0 flex-1">
                <Textarea
                  ref={composerRef}
                  value={agentInput}
                  onChange={(e) => onInputChange(e.target.value)}
                  onInput={resizeComposer}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSendMessage();
                    }
                  }}
                  rows={1}
                  className="box-border w-full min-w-0 max-w-full resize-none overflow-x-hidden overflow-y-auto min-h-[48px] max-h-[160px] rounded-xl border-gray-200 text-[14px] focus-visible:ring-blue-500"
                  placeholder="Example: make 3 product posts for Instagram"
                  disabled={generating}
                />
              </div>
              <Button
                onClick={() => onSendMessage()}
                disabled={generating || !agentInput.trim()}
                className="h-12 w-12 shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700"
                title={`Uses ${totalEstimatedNomi} Nomi's`}
              >
                {generating ? (
                  <div className="w-4 h-4 border-2 rounded-full border-white/30 border-t-white animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
