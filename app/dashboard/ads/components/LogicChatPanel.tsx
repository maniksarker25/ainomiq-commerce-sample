"use client";

import Link from "next/link";
import { Link2, Loader2, Send, Sparkles } from "lucide-react";
import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import type { Campaign, ProductFolder, StrategistChatMessage } from "../types";
import { sanitizeChatText } from "../utils";
import { MessageBubble } from "@/app/dashboard/cs/_components/MessageBubble";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type LogicChatPanelProps = {
  hasBrandScrape: boolean;
  brandDataScanHref: string;
  strategistListRef: RefObject<HTMLDivElement | null>;
  strategistScrollTargetRef: RefObject<HTMLDivElement | null>;
  strategistMessages: StrategistChatMessage[];
  setStrategistMessages: Dispatch<SetStateAction<StrategistChatMessage[]>>;
  strategistLoading: boolean;
  strategistCreating: boolean;
  productCatalogItems: ProductFolder[];
  selectedCatalogItems: ProductFolder[];
  landingOptionsFor: (
    products: ProductFolder[],
  ) => Array<{ label: string; url: string }>;
  setSelectedProductIds: Dispatch<SetStateAction<string[]>>;
  setDestinationUrl: Dispatch<SetStateAction<string>>;
  askStrategist: (prompt?: string) => void | Promise<void>;
  setCampaignMode: Dispatch<SetStateAction<"existing" | "new">>;
  setSelectedCampaignId: Dispatch<SetStateAction<string>>;
  setStickyStrategistCampaign: Dispatch<SetStateAction<Campaign | null>>;
  createPromptForMessage: (message: StrategistChatMessage) => string;
  messageHasCreateCta: (message: StrategistChatMessage) => boolean;
  strategistQuickPrompts: string[];
  logicChatNeedsMoreNomi: boolean;
  logicChatUsesNomi: boolean;
  logicChatNomiCost: number;
  nomiBalance: number;
  strategistPrompt: string;
  setStrategistPrompt: Dispatch<SetStateAction<string>>;
  selectedCatalogCount: number;
  hasCampaignContext: boolean;
  strategistError: string | null;
};

function OptionGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Card className="mt-3 shadow-none border-primary/10 bg-background/80">
      <CardContent className="p-3 space-y-2">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </Label>
        <div className="flex flex-wrap gap-2">{children}</div>
      </CardContent>
    </Card>
  );
}

export default function LogicChatPanel({
  hasBrandScrape,
  brandDataScanHref,
  strategistListRef,
  strategistScrollTargetRef,
  strategistMessages,
  setStrategistMessages,
  strategistLoading,
  strategistCreating,
  productCatalogItems,
  selectedCatalogItems,
  landingOptionsFor,
  setSelectedProductIds,
  setDestinationUrl,
  askStrategist,
  setCampaignMode,
  setSelectedCampaignId,
  setStickyStrategistCampaign,
  createPromptForMessage,
  messageHasCreateCta,
  strategistQuickPrompts,
  logicChatNeedsMoreNomi,
  logicChatUsesNomi,
  logicChatNomiCost,
  nomiBalance,
  strategistPrompt,
  setStrategistPrompt,
  selectedCatalogCount,
  hasCampaignContext,
  strategistError,
}: LogicChatPanelProps) {
  const chatBusy = strategistLoading || strategistCreating;
  const sendDisabled =
    chatBusy || logicChatNeedsMoreNomi || !strategistPrompt.trim();

  function handleQuickReply(reply: string, message: StrategistChatMessage) {
    if (reply === "Use all catalog products") {
      setSelectedProductIds(productCatalogItems.map((item) => item.id));
      setStrategistMessages((current) => [
        ...current,
        {
          id: `assistant-landing-options-${Date.now()}`,
          role: "assistant",
          text: "Selected all catalog products. What landing page should the ads send traffic to?",
          landingOptions: landingOptionsFor(productCatalogItems),
          quickReplies: ["Use the product page", "Ask me for a custom URL"],
          campaignResumePrompt: message.campaignResumePrompt,
        },
      ]);
      return;
    }
    if (reply === "Use the product page") {
      const productUrl =
        selectedCatalogItems.find((item) => item.url)?.url ||
        message.landingOptions?.[0]?.url ||
        "";
      if (productUrl) {
        setDestinationUrl(productUrl);
        void askStrategist(
          `Use landing page ${productUrl}. ${message.campaignResumePrompt || "Build the campaign."}`,
        );
      } else {
        setStrategistMessages((current) => [
          ...current,
          {
            id: `assistant-custom-url-${Date.now()}`,
            role: "assistant",
            text: "I do not have a product page URL for that item yet. Paste the landing page URL here and I will continue the campaign setup.",
            campaignResumePrompt: message.campaignResumePrompt,
          },
        ]);
      }
      return;
    }
    if (reply === "Ask me for a custom URL") {
      setStrategistMessages((current) => [
        ...current,
        {
          id: `assistant-custom-url-${Date.now()}`,
          role: "assistant",
          text: "Paste the landing page URL here. After that I will continue the campaign setup.",
          campaignResumePrompt: message.campaignResumePrompt,
        },
      ]);
      return;
    }
    if (reply === "Create a new campaign draft") {
      setCampaignMode("new");
      setStrategistMessages((current) => [
        ...current,
        {
          id: `assistant-new-campaign-${Date.now()}`,
          role: "assistant",
          text: "New campaign draft selected. Send the campaign name, budget and markets, or click recommend setup and I will propose the structure first.",
          quickReplies: ["Recommend setup from context"],
          campaignResumePrompt: message.campaignResumePrompt,
        },
      ]);
      return;
    }
    void askStrategist(reply);
  }

  function renderMessageExtras(message: StrategistChatMessage) {
    return (
      <>
        {message.productOptions?.length ? (
          <OptionGroup label="Product or catalog">
            {message.productOptions.map((product) => (
              <Button
                key={product.id}
                type="button"
                variant="outline"
                size="sm"
                className="h-auto text-left whitespace-normal"
                onClick={() => {
                  setSelectedProductIds([product.id]);
                  setStrategistMessages((current) => [
                    ...current,
                    {
                      id: `assistant-landing-options-${Date.now()}`,
                      role: "assistant",
                      text: `Selected ${product.name}. What landing page should the ads send traffic to?`,
                      landingOptions: landingOptionsFor([product]),
                      quickReplies: [
                        "Use the product page",
                        "Ask me for a custom URL",
                      ],
                      campaignResumePrompt: message.campaignResumePrompt,
                    },
                  ]);
                }}
              >
                {product.name}
              </Button>
            ))}
          </OptionGroup>
        ) : null}

        {message.landingOptions?.length ? (
          <OptionGroup label="Landing page">
            {message.landingOptions.map((option) => (
              <Button
                key={`${option.label}-${option.url}`}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setDestinationUrl(option.url);
                  void askStrategist(
                    `Use landing page ${option.url}. ${message.campaignResumePrompt || "Build the campaign."}`,
                  );
                }}
              >
                {option.label}
              </Button>
            ))}
          </OptionGroup>
        ) : null}

        {message.quickReplies?.length ? (
          <div className="flex flex-wrap gap-2 mt-3">
            {message.quickReplies.map((reply) => (
              <Button
                key={reply}
                type="button"
                variant="secondary"
                size="sm"
                className="h-auto text-left whitespace-normal"
                onClick={() => handleQuickReply(reply, message)}
              >
                {reply}
              </Button>
            ))}
          </div>
        ) : null}

        {message.campaignOptions?.length ? (
          <OptionGroup label="Campaign">
            {message.campaignOptions.map((campaign) => (
              <Button
                key={campaign.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCampaignId(campaign.id);
                  setStickyStrategistCampaign(campaign);
                  void askStrategist(
                    `Use campaign ${campaign.name}. ${message.campaignResumePrompt || ""}`,
                  );
                }}
              >
                {campaign.name}
              </Button>
            ))}
          </OptionGroup>
        ) : null}

        {message.errorDetail ? (
          <Alert variant="destructive" className="mt-3">
            <AlertTitle className="text-xs tracking-wide uppercase">
              Error detail
            </AlertTitle>
            <AlertDescription className="whitespace-pre-wrap wrap-break-word">
              {message.errorDetail}
            </AlertDescription>
          </Alert>
        ) : null}

        {message.accessAction ? (
          <Button
            type="button"
            size="sm"
            className="mt-3"
            onClick={() => {
              window.location.href = message.accessAction!.url;
            }}
          >
            {message.accessAction.label}
            <Link2 className="size-3.5" />
          </Button>
        ) : null}

        {message.result?.creation_plan?.ready === true &&
        message.result?.creation_plan?.summary ? (
          <Alert className="mt-3 border-primary/15 bg-primary/5">
            <AlertTitle className="text-xs tracking-wide uppercase text-primary">
              Ready to create
            </AlertTitle>
            <AlertDescription className="space-y-3 text-foreground">
              <p>{message.result.creation_plan.summary}</p>
              <Button
                type="button"
                size="sm"
                disabled={chatBusy}
                onClick={() => askStrategist(createPromptForMessage(message))}
              >
                {message.result.creation_plan.create_scope === "adsets"
                  ? "Create ad sets"
                  : "Create campaign"}
                <Send className="size-3.5" />
              </Button>
              <p className="text-xs text-muted-foreground">
                Click the button or type create. Meta creates it paused first.
              </p>
            </AlertDescription>
          </Alert>
        ) : messageHasCreateCta(message) ? (
          <Button
            type="button"
            size="sm"
            className="mt-3"
            disabled={chatBusy}
            onClick={() => askStrategist(createPromptForMessage(message))}
          >
            {createPromptForMessage(message).includes("ad sets")
              ? "Create ad sets"
              : "Create campaign"}
            <Send className="size-3.5" />
          </Button>
        ) : null}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {!hasBrandScrape ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
          <AlertTitle>Brand Data scan needed</AlertTitle>
          <AlertDescription>
            Analyze the business in General Settings first. This loads products,
            collections and source content before ad creation starts.
          </AlertDescription>
          <Button asChild size="sm" className="mt-3">
            <Link href={brandDataScanHref}>Analyze business</Link>
          </Button>
        </Alert>
      ) : null}

      <Card className="gap-0 overflow-hidden shadow-none">
        <ScrollArea className="h-[min(560px,62vh)]">
          <div ref={strategistListRef} className="p-4 space-y-4">
            {strategistMessages.map((message, index) => {
              const isUser = message.role === "user";
              return (
                <div
                  key={message.id}
                  ref={
                    index === strategistMessages.length - 1 &&
                    !strategistLoading &&
                    !strategistCreating
                      ? strategistScrollTargetRef
                      : undefined
                  }
                  className={cn(
                    "flex w-full",
                    isUser ? "justify-end" : "justify-start",
                  )}
                >
                  <MessageBubble
                    speaker={isUser ? undefined : "Logic Chat"}
                    variant={isUser ? "outgoing" : "incoming"}
                    align={isUser ? "end" : "start"}
                    className={cn(
                      "max-w-[88%]",
                      isUser &&
                        "border-primary bg-primary text-primary-foreground [&_.text-muted-foreground]:text-primary-foreground/80",
                    )}
                  >
                    <span
                      className={isUser ? "text-primary-foreground" : undefined}
                    >
                      {sanitizeChatText(message.text)}
                    </span>
                    {!isUser ? renderMessageExtras(message) : null}
                  </MessageBubble>
                </div>
              );
            })}

            {chatBusy ? (
              <div
                ref={strategistScrollTargetRef}
                className="flex justify-start"
              >
                <MessageBubble variant="incoming" className="max-w-[88%]">
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    {strategistCreating ? "Creating in Meta..." : "Thinking..."}
                  </span>
                </MessageBubble>
              </div>
            ) : null}
          </div>
        </ScrollArea>

        <Separator />

        <CardFooter className="flex flex-col items-stretch gap-4 p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5" />
              Try asking
            </div>
            <div className="flex flex-wrap gap-2">
              {strategistQuickPrompts.map((prompt) => (
                <Button
                  key={prompt}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto max-w-full text-left whitespace-normal"
                  disabled={chatBusy || logicChatNeedsMoreNomi}
                  onClick={() => askStrategist(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-2 p-2 border shadow-sm rounded-2xl bg-background">
            <Textarea
              value={strategistPrompt}
              onChange={(event) => setStrategistPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void askStrategist();
                }
              }}
              placeholder="Message Logic Chat..."
              rows={1}
              className="flex-1 px-2 py-2 bg-transparent border-0 shadow-none resize-none max-h-32 min-h-11 focus-visible:ring-0"
            />
            <div className="mb-0.5 flex shrink-0 items-center gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-muted-foreground"
                  >
                    {logicChatUsesNomi
                      ? `${logicChatNomiCost} Nomi${logicChatNomiCost === 1 ? "" : "'s"}`
                      : "Free"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold tracking-wide uppercase text-primary">
                      Logic Chat
                    </span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        logicChatUsesNomi
                          ? logicChatNeedsMoreNomi
                            ? "bg-destructive/10 text-destructive"
                            : "bg-primary/10 text-primary"
                          : "bg-emerald-50 text-emerald-700",
                      )}
                    >
                      {logicChatUsesNomi
                        ? `${logicChatNomiCost} Nomi${logicChatNomiCost === 1 ? "" : "'s"}`
                        : "Free"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {logicChatUsesNomi
                      ? "Launch uses Nomi for strategist replies."
                      : "Included in this Nomi pass."}
                  </p>
                  {logicChatNeedsMoreNomi ? (
                    <p className="mt-2 text-xs font-medium text-destructive">
                      Balance {nomiBalance}. Need{" "}
                      {logicChatNomiCost - nomiBalance} more Nomi
                      {logicChatNomiCost - nomiBalance === 1 ? "" : "'s"}.
                    </p>
                  ) : null}
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                size="icon"
                className="rounded-full shrink-0"
                disabled={sendDisabled}
                onClick={() => askStrategist()}
                aria-label={
                  logicChatUsesNomi
                    ? `Send message, uses ${logicChatNomiCost} Nomi${logicChatNomiCost === 1 ? "" : "'s"}`
                    : "Send message, included"
                }
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>

          {selectedCatalogCount > 0 && !hasCampaignContext ? (
            <Alert className="border-primary/15 bg-primary/5">
              <AlertDescription className="text-primary">
                You can discuss the plan now. Select or create a campaign before
                creating.
              </AlertDescription>
            </Alert>
          ) : null}

          {strategistError ? (
            <Alert variant="destructive">
              <AlertDescription>{strategistError}</AlertDescription>
            </Alert>
          ) : null}
        </CardFooter>
      </Card>
    </div>
  );
}
