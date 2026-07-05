"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  contentApiFetch,
  streamContentAgentChat,
  toastContentApiError,
} from "./_lib/content-api";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { estimatedAiCreativeNomiForImages } from "@/lib/content-image-billing";
import {
  CONTENT_IMAGE_MODELS,
  getContentImageModel,
} from "@/lib/content-image-models";
import type { StudioSyncStatus } from "./_components/ChatInterface";
import Link from "next/link";
import {
  MessageSquare,
  LayoutTemplate,
  Calendar,
  Settings,
  LayoutDashboard,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Search,
  RefreshCw,
} from "lucide-react";

import { fetchSession, type Session } from "@/lib/session";
import AppSettingsPanel from "@/components/AppSettingsPanel";
import { PillTabBar } from "@/components/PillTabBar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// Local Lib & Components
import {
  ContentConfig,
  BrandProfile,
  ChatMessage,
  Draft,
  SavedTemplate,
  ScheduledPost,
  PlatformConnection,
  MenuKey,
  ManualLayout,
} from "./_lib/types";
import {
  cleanDisplayText,
  customerCaption,
  visibleTemplateCount,
  templateStyle,
  templateDisplayCopy,
  templatePurpose,
  shortWords,
  feedbackTargetIndexes,
  feedbackTargetLabel,
  stripFeedbackTargetWords,
  hasVisibleTemplateChange,
  sameAsset,
  hasFinalImage,
} from "./_lib/utils";
import { ChatInterface } from "./_components/ChatInterface";
import { QuickActions } from "./_components/QuickActions";
import { TemplatesTab } from "./_components/TemplatesTab";
import { PlannerTab } from "./_components/PlannerTab";
import {
  VisualTemplateCard,
  ImageSlot,
} from "./_components/VisualTemplateCard";
import { FinalFeedPostCard } from "./_components/FinalFeedPostCard";
import { ManualEditor } from "./_components/ManualEditor";
import { StudioSettings } from "./_components/StudioSettings";
import { migrateManualLayout } from "./_lib/manual-canvas";
import {
  buildScheduledPostsFromDrafts,
  buildWeeklyFeedGenerationPrompt,
  draftFromSavedTemplate,
} from "./_lib/planner";
import {
  computeScheduledAt,
  DEFAULT_PUBLISH_TIMEZONE,
  migrateScheduledPosts,
} from "@/lib/content-studio-schedule-utils";

export default function ContentPipelineDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [config, setConfig] = useState<ContentConfig | null>(null);
  const [configBaseline, setConfigBaseline] = useState<ContentConfig | null>(
    null,
  );
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState("");
  const [product, setProduct] = useState("");
  const [weeklyPostCount, setWeeklyPostCount] = useState(5);
  const [topicGenerationIndex, setTopicGenerationIndex] = useState(0);
  const [selectedModel, setSelectedModel] = useState(
    CONTENT_IMAGE_MODELS[0].id,
  );
  const [generating, setGenerating] = useState(false);
  const [generatingPhase, setGeneratingPhase] = useState("");
  const [publishingPostId, setPublishingPostId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [studioSyncStatus, setStudioSyncStatus] =
    useState<StudioSyncStatus>("idle");

  const [agentInput, setAgentInput] = useState("");
  const [templateFeedback, setTemplateFeedback] = useState("");
  const [updatingTemplateIndexes, setUpdatingTemplateIndexes] = useState<
    number[]
  >([]);
  const [generatingVisualDraftIds, setGeneratingVisualDraftIds] = useState<
    string[]
  >([]);
  const [editingDraftId, setEditingDraftId] = useState<string>("");
  const [editingDraftIndex, setEditingDraftIndex] = useState<number>(-1);
  const [editingDraftSnapshot, setEditingDraftSnapshot] =
    useState<Draft | null>(null);
  const [manualEditor, setManualEditor] = useState<ManualLayout | null>(null);
  const [manualEditorSeed, setManualEditorSeed] = useState(0);
  const [previewFeedOpen, setPreviewFeedOpen] = useState(false);

  const [chat, setChat] = useState<ChatMessage[]>([
    {
      role: "agent",
      text: "I am your Content Studio. Choose a product or ask for a content idea. I will create clear 4:5 posts using Brand Data and product images when available.",
    },
  ]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [activeMenu, setActiveMenu] = useState<MenuKey>("agent");
  const [platforms, setPlatforms] = useState<
    Record<string, PlatformConnection>
  >({});
  const [storageKey, setStorageKey] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const hydratedRef = useRef(false);
  const skipNextServerSaveRef = useRef(false);
  const [selectedDraftId, setSelectedDraftId] = useState("");
  const lastServerSaveRef = useRef("");

  const tenantId = session?.tenantId || session?.email || "";
  const productCatalog = useMemo(() => {
    const items = brandProfile?.source_summary?.product_catalog;
    return Array.isArray(items)
      ? items.filter((item) => item?.title).slice(0, 36)
      : [];
  }, [brandProfile]);

  const selectedProduct =
    productCatalog.find((item) => item.title === product) || null;
  const productForGeneration =
    selectedProduct || (!product.trim() ? productCatalog[0] || null : null);
  const productCount =
    brandProfile?.source_summary?.products || productCatalog.length;
  const selectedImageModel = useMemo(
    () => getContentImageModel(selectedModel),
    [selectedModel],
  );
  const contentChatNomiCost = 2 * CREDIT_COSTS.ai_copy;

  function estimateSendNomi(_text: string) {
    return {
      chatNomi: contentChatNomiCost,
      imageNomi: 0,
      total: contentChatNomiCost,
    };
  }

  const pendingSendEstimate = useMemo(
    () => estimateSendNomi(agentInput),
    [agentInput, productForGeneration, selectedModel],
  );

  const nextActions = useMemo(
    () => [
      productCatalog.length
        ? "Make 3 product posts from my catalog"
        : "Make 3 product posts",
      "Help me choose 3 content topics",
      "Make 5 reusable templates with product image slots",
      "Improve my current templates",
    ],
    [productCatalog.length],
  );

  // --- Handlers & Internal Logic (Preserving Functionality) ---

  function fallbackRefinedTemplate(
    original: Draft,
    feedback: string,
    fallbackIndex: number,
  ) {
    const request = stripFeedbackTargetWords(feedback);
    const headline =
      shortWords(request || "Updated template", 6, 46) || "Updated template";
    const sections = splitDraftSections(original.content || "");
    const nextStyle = ((original.templateIndex ?? fallbackIndex) + 1) % 5;
    const caption =
      sections.caption ||
      customerCaption(original.content).split("\n").find(Boolean) ||
      "Updated based on your feedback.";
    return {
      ...original,
      id: `${Date.now()}-refined-${Math.random().toString(16).slice(2)}`,
      title:
        `${original.title.replace(/\s+\(updated\)$/i, "")} (updated)`.slice(
          0,
          140,
        ),
      content: `Image: Updated visual area matching the requested change.\nHeadline: ${headline}\nSubline: Cleaner, updated version of this template.\nCaption: ${caption}`,
      templateIndex: nextStyle,
      cleanAlign: true,
    };
  }

  function splitDraftSections(content: string) {
    const sections: Record<string, string> = {};
    cleanDisplayText(content)
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const match = line.match(
          /^(visual\s*direction|direction|layout|image|image\s*direction|headline|title|copy|caption|subline|body)\s*:\s*(.+)$/i,
        );
        if (match)
          sections[match[1].toLowerCase().replace(/\s+/g, "_")] =
            match[2].trim();
      });
    return sections;
  }

  function manualLayoutFromDraft(draft: Draft, index: number): ManualLayout {
    const styleIndex =
      typeof draft.templateIndex === "number" ? draft.templateIndex : index;
    const style = templateStyle(styleIndex);
    const copy = templateDisplayCopy(draft, index);
    const base = {
      headline: copy.headline,
      subline: copy.subline || "",
      caption: customerCaption(draft.content),
      extraText: templatePurpose(styleIndex),
      showImage: true,
      showHeadline: true,
      showSubline: Boolean(copy.subline),
      showExtraText: true,
      showAccent: true,
      showCaption: true,
    };
    if (style === "graphic-hub")
      return {
        ...base,
        textX: 52,
        textY: 28,
        textW: 38,
        imageX: 5,
        imageY: 5,
        imageW: 42,
        imageH: 90,
        accentX: 52,
        accentY: 87,
        accentW: 16,
        accentH: 1.5,
      };
    if (style === "dark-loop")
      return {
        ...base,
        textX: 8,
        textY: 58,
        textW: 76,
        imageX: 8,
        imageY: 18,
        imageW: 84,
        imageH: 38,
        accentX: 8,
        accentY: 88,
        accentW: 17,
        accentH: 1.5,
      };
    if (style === "editorial-band")
      return {
        ...base,
        textX: 14,
        textY: 38,
        textW: 42,
        imageX: 63,
        imageY: 35,
        imageW: 29,
        imageH: 32,
        accentX: 0,
        accentY: 0,
        accentW: 4,
        accentH: 100,
      };
    if (style === "modular-frame")
      return {
        ...base,
        textX: 10,
        textY: 58,
        textW: 76,
        imageX: 24,
        imageY: 28,
        imageW: 52,
        imageH: 25,
        accentX: 5,
        accentY: 5,
        accentW: 90,
        accentH: 0.6,
      };
    return {
      ...base,
      textX: 8,
      textY: 64,
      textW: 80,
      imageX: 8,
      imageY: 8,
      imageW: 84,
      imageH: 47,
      accentX: 8,
      accentY: 91,
      accentW: 14,
      accentH: 1.5,
    };
  }

  function normalizeManualLayout(draft: Draft, index: number): ManualLayout {
    const inferred = manualLayoutFromDraft(draft, index);
    if (!draft.manualLayout) return migrateManualLayout(inferred);
    return migrateManualLayout({
      ...inferred,
      ...draft.manualLayout,
      textW: draft.manualLayout.textW ?? inferred.textW,
      accentW: draft.manualLayout.accentW ?? inferred.accentW,
      accentH: draft.manualLayout.accentH ?? inferred.accentH,
      extraText: draft.manualLayout.extraText || inferred.extraText,
      caption: draft.manualLayout.caption || inferred.caption,
    });
  }

  function manualLayoutWithFreshCopy(
    draft: Draft,
    index: number,
    sourceLayout?: ManualLayout,
  ): ManualLayout {
    const inferred = manualLayoutFromDraft(draft, index);
    if (!sourceLayout) return inferred;
    return {
      ...inferred,
      ...sourceLayout,
      headline: inferred.headline,
      subline: inferred.subline,
      caption: inferred.caption,
      extraText: sourceLayout.extraText || inferred.extraText,
      textW: sourceLayout.textW ?? inferred.textW,
      accentW: sourceLayout.accentW ?? inferred.accentW,
      accentH: sourceLayout.accentH ?? inferred.accentH,
    };
  }

  function makeTopic(index = topicGenerationIndex) {
    const focus = (
      selectedProduct?.title ||
      product ||
      config?.product_focus ||
      productCatalog[0]?.title ||
      "the main offer"
    ).trim();
    const topics = [
      `Product spotlight: ${focus}`,
      `How to style ${focus}`,
      `Why customers choose ${focus}`,
      `New drop focus: ${focus}`,
    ];
    return topics[index % topics.length];
  }

  function generateTopic() {
    const nextTopic = makeTopic();
    setTopicGenerationIndex((current) => current + 1);
    setTopic(nextTopic);
    if (!product.trim() && config?.product_focus)
      setProduct(config.product_focus);
    toast.success("Topic generated from Brand Data.");
  }

  function generateWeeklyDirection() {
    const focus = (config?.product_focus || product || "the main offer").trim();
    const audience = (config?.target_audience || "the ideal customer").trim();
    const voice = (
      config?.brand_voice ||
      brandProfile?.brand_tone ||
      "clear, helpful and confident"
    ).trim();
    const options = [
      `Mix education, proof, objections, feature highlights, behind the scenes, and one soft CTA for ${focus}. Keep it useful for ${audience}.`,
      `Create a week that explains the problem, shows the solution, builds trust, answers objections, highlights one feature, shares a customer-style proof post, and ends with a soft CTA for ${focus}.`,
      `Use a ${voice} tone. Balance helpful tips, product value, proof, founder or process context, objection handling, and one light conversion post for ${focus}.`,
      `Make the week feel varied: one educational post, one proof post, one feature post, one mistake-to-avoid post, one comparison post, one behind-the-scenes post, and one soft CTA around ${focus}.`,
    ];
    const next = options[topicGenerationIndex % options.length];
    setTopic(next);
    setTopicGenerationIndex((index) => index + 1);
    toast.success("Weekly direction generated.");
  }

  function resetChat() {
    setChat([
      {
        role: "agent",
        text: "I am your Content Studio. Choose a product or ask for a content idea. I will create clear 4:5 posts using Brand Data and product images when available.",
      },
    ]);
    toast.info("Chat reset.");
  }

  function wantsIdeationFirst(text: string) {
    return (
      /(wat past|what fits|wat zou|what would|idee|ide[eë]n|bedenk|bedenken|brainstorm|help me choose|help.*choose|leuk idee|gave|mooi.*post|eerste post|first post|\?)/i.test(
        text,
      ) &&
      !/(maak dit|make this|generate this|create this|ga door|go ahead|gebruik deze|use this|werk uit|work out|maak nu|make now)/i.test(
        text,
      )
    );
  }

  function isCarouselContext(text: string) {
    return /slideshow|slide show|carousel|carrousel|slide|slides|1 verhaal|one story|eerste post|first post/i.test(
      text,
    );
  }

  function agentActionLabel(text: string, count: number) {
    const lower = text.toLowerCase();
    if (isCarouselContext(lower)) return `Show ${count} carousel slides`;
    if (/foto|photo|image|afbeelding|visual|plaatje/.test(lower))
      return `Show ${count} visual posts`;
    if (/post|posts|first post|eerste post/.test(lower))
      return `Show ${count} posts`;
    return `Show ${count === 1 ? "draft" : `${count} drafts`}`;
  }

  async function sendAgentMessage(textOverride?: string) {
    const text = (textOverride || agentInput).trim();
    if (!text || !tenantId) return;
    const ideationFirst = wantsIdeationFirst(text);
    const looksLikeTemplateFeedback =
      !ideationFirst &&
      drafts.length > 0 &&
      /(improve|update|refine|change|edit|adjust|pas|aan|maak|verwijder|remove|align|aligned|alignment|mooier|clean|netter|strakker|premium|logo|logos|logis|rounded|round|corners|corner|frames|frame|image|images|template|templates|tmplte|tmpltes)/i.test(
        text,
      ) &&
      /(template|templates|tmplte|tmpltes|current|deze|huidige|logo|logos|logis|align|aligned|alignment|mooier|clean|netter|strakker|premium|rounded|round|corners|corner|frames|frame|image|images)/i.test(
        text,
      );

    if (looksLikeTemplateFeedback) {
      setAgentInput("");
      setActiveMenu("drafts");
      setChat((current) => [...current, { role: "user", text }]);
      const result = await refineTemplatesWithFeedback(text);
      setChat((current) => [
        ...current,
        {
          role: "agent",
          text: result.updated
            ? `Done. I updated ${result.targetLabel} with that feedback.`
            : `I could not update ${result.targetLabel}.`,
          action: {
            label: `Show ${visibleTemplateCount(drafts.length)} templates`,
            draftId: result.draftId || drafts[0]?.id,
          },
        },
      ]);
      return;
    }

    setAgentInput("");
    const nextChat: ChatMessage[] = [...chat, { role: "user", text }];
    setChat([...nextChat, { role: "agent", text: "", streaming: true }]);
    setGenerating(true);
    setGeneratingPhase("thinking");

    try {
      const data = await streamContentAgentChat(
        {
          tenant_id: tenantId,
          message: text,
          history: nextChat
            .slice(-12)
            .map((item) => ({ role: item.role, content: item.text })),
          selected_product: productForGeneration,
          product_catalog: productCatalog,
          planning_mode: ideationFirst,
          ai_image_model: selectedModel,
          output_mode: isCarouselContext(
            nextChat.map((item) => item.text).join(" "),
          )
            ? "carousel"
            : "auto",
        },
        {
          onDelta: (reply) => {
            setChat((current) => {
              const copy = [...current];
              const last = copy[copy.length - 1];
              if (last?.role === "agent" && last.streaming) {
                copy[copy.length - 1] = {
                  ...last,
                  text: cleanDisplayText(reply),
                };
              }
              return copy;
            });
          },
          onPhase: () => setGeneratingPhase("thinking"),
        },
      );

      const conversationText = nextChat.map((item) => item.text).join(" ");
      const carouselOutput = isCarouselContext(conversationText);
      const nextDrafts: Draft[] = Array.isArray(data.drafts)
        ? data.drafts
            .map((draft, index: number) => ({
              id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
              title: String(draft.title || "Content post").slice(0, 140),
              type: String(
                draft.type || (carouselOutput ? "Carousel Slide" : "Draft"),
              ).slice(0, 80),
              content: String(draft.content || "").trim(),
              status: "Draft" as const,
              templateIndex: carouselOutput ? 0 : index,
              roundedFrames: carouselOutput ? true : undefined,
              imageUrl:
                typeof draft.image_url === "string" ? draft.image_url : null,
              imageError:
                typeof draft.image_error === "string"
                  ? draft.image_error
                  : null,
              visualPrompt:
                typeof draft.visual_prompt === "string"
                  ? draft.visual_prompt
                  : null,
            }))
            .filter((draft: Draft) => draft.content)
        : [];

      if (nextDrafts.length) {
        setDrafts((current) => [...nextDrafts, ...current].slice(0, 30));
        setSelectedDraftId(nextDrafts[0].id);
      }

      const needsClarification = data.needs_clarification === true;
      const questions = Array.isArray(data.questions)
        ? data.questions
            .map((q) => String(q).trim())
            .filter(Boolean)
            .slice(0, 3)
        : [];

      setChat((current) => {
        const withoutStream = current.filter((item) => !item.streaming);
        return [
          ...withoutStream,
          {
            role: "agent",
            text: cleanDisplayText(
              data.reply || "I used your Brand Data and prepared a post.",
            ),
            needsClarification,
            clarificationQuestions: needsClarification ? questions : undefined,
            action:
              !needsClarification && nextDrafts.length
                ? {
                    label: agentActionLabel(
                      conversationText,
                      nextDrafts.length,
                    ),
                    draftId: nextDrafts[0].id,
                  }
                : undefined,
          },
        ];
      });
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Agent chat failed.";
      setChat((current) => {
        const withoutStream = current.filter((item) => !item.streaming);
        return [...withoutStream, { role: "agent", text: errorMsg }];
      });
      toastContentApiError(err, "Agent chat failed.");
    } finally {
      setGenerating(false);
      setGeneratingPhase("");
    }
  }

  function updateDraftVisualPrompt(draftId: string, nextPrompt: string) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === draftId
          ? { ...draft, visualPrompt: nextPrompt.slice(0, 2400) }
          : draft,
      ),
    );
  }

  async function generateDraftVisual(draftId: string) {
    if (!tenantId || !draftId) return;
    const target = drafts.find((draft) => draft.id === draftId);
    if (!target) return;

    const fallbackPrompt = cleanDisplayText(
      target.content || `${target.title} social post visual`,
    ).slice(0, 1200);
    const visualPrompt = (target.visualPrompt || fallbackPrompt).trim();
    if (!visualPrompt) {
      toast.warning("No visual prompt available for this draft yet.");
      return;
    }

    const imageNomi = estimatedAiCreativeNomiForImages(1, selectedModel);
    setGeneratingVisualDraftIds((current) => [
      ...new Set([...current, draftId]),
    ]);
    try {
      const data = await contentApiFetch<{
        image_url?: string | null;
        image_error?: string | null;
      }>("/api/content/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          visual_prompt: visualPrompt,
          ai_image_model: selectedModel,
        }),
      });

      setDrafts((current) =>
        current.map((draft) =>
          draft.id === draftId
            ? {
                ...draft,
                imageUrl:
                  typeof data.image_url === "string"
                    ? data.image_url
                    : draft.imageUrl || null,
                imageError:
                  typeof data.image_error === "string"
                    ? data.image_error
                    : null,
              }
            : draft,
        ),
      );

      setSavedTemplates((current) =>
        current.map((template) =>
          template.id === target.templateId
            ? {
                ...template,
                imageUrl:
                  typeof data.image_url === "string"
                    ? data.image_url
                    : template.imageUrl || null,
                imageError:
                  typeof data.image_error === "string"
                    ? data.image_error
                    : null,
              }
            : template,
        ),
      );

      if (typeof data.image_url === "string" && data.image_url.trim()) {
        toast.success(`Visual generated for ${imageNomi} Nomi's.`);
      } else {
        toast.warning(
          data.image_error || "Image generation did not return a visual.",
        );
      }
    } catch (err: unknown) {
      toastContentApiError(err, "Visual generation failed.");
    } finally {
      setGeneratingVisualDraftIds((current) =>
        current.filter((id) => id !== draftId),
      );
    }
  }

  function savedTemplateFromDraft(
    draft: Draft,
    index: number,
    existing?: SavedTemplate,
  ): SavedTemplate {
    const styleIndex =
      typeof draft.templateIndex === "number" ? draft.templateIndex : index;
    const id = draft.templateId || `auto-${draft.id}`;
    return {
      id,
      title:
        draft.title.replace(/^Template\s*\d+\s*-\s*/i, "").slice(0, 90) ||
        `Template ${index + 1}`,
      content: draft.content,
      styleIndex,
      purpose: templatePurpose(styleIndex),
      createdAt: existing?.createdAt || new Date().toISOString(),
      hideLogo: draft.hideLogo,
      cleanAlign: draft.cleanAlign,
      roundedFrames: draft.roundedFrames,
      updatedAt: draft.updatedAt || existing?.updatedAt,
      manualLayout: draft.manualLayout,
      imageUrl: draft.imageUrl || existing?.imageUrl || null,
      imageError: draft.imageError || existing?.imageError || null,
    };
  }

  function saveDraftToTemplates(draft: Draft, index: number) {
    const templateId = draft.templateId || `auto-${draft.id}`;
    const existing = savedTemplates.find((t) => t.id === templateId);
    const newTemplate = savedTemplateFromDraft(draft, index, existing);

    setSavedTemplates((current) => {
      const idx = current.findIndex((t) => t.id === newTemplate.id);
      if (idx >= 0) {
        return current.map((t) => (t.id === newTemplate.id ? newTemplate : t));
      } else {
        if (current.length >= 20) {
          toast.error("Template library is full (max 20 templates).");
          return current;
        }
        return [...current, newTemplate];
      }
    });

    setDrafts((current) =>
      current.map((d) =>
        d.id === draft.id ? { ...d, templateId: newTemplate.id } : d,
      ),
    );

    toast.success(`"${newTemplate.title}" saved to template library.`);
  }

  function deleteSavedTemplate(templateId: string) {
    setSavedTemplates((current) => current.filter((t) => t.id !== templateId));
    setDrafts((current) =>
      current.map((d) =>
        d.templateId === templateId ? { ...d, templateId: undefined } : d,
      ),
    );
    toast.info("Template removed from library.");
  }

  function seedDefaultTemplates() {
    const brandName = config?.brand_name || brandProfile?.brand_name || "Ainomiq";
    const tone = `${brandProfile?.brand_tone || "premium"}`;

    const defaults: Draft[] = [
      {
        id: `seed-editorial-0`,
        title: "Editorial Split Frame",
        type: "Design Template",
        content: `Headline: Elevating ${brandName}\nSubline: Crafted for the modern audience with ${tone} touch.\nCaption: Experience the new standard. Discover how we are changing the game. #brand`,
        templateIndex: 3,
        status: "Draft",
      },
      {
        id: `seed-photo-1`,
        title: "Feature Spotlight",
        type: "Design Template",
        content: `Headline: Minimalist design, maximal impact.\nSubline: Spotlight on the core values of ${brandName}.\nCaption: Simple, aesthetic, and functional. Take a closer look at what makes us different.`,
        templateIndex: 0,
        status: "Draft",
      },
      {
        id: `seed-modular-2`,
        title: "Modular Layout",
        type: "Design Template",
        content: `Headline: Built to scale.\nSubline: The structured approach to business.\nCaption: Discover our latest modules and feature lists. Streamlined for clarity and precision.`,
        templateIndex: 4,
        status: "Draft",
      },
    ];

    const newTemplates = defaults.map((d, index) => savedTemplateFromDraft(d, index));
    setSavedTemplates(newTemplates);
    setDrafts(defaults);
    toast.success("Created 3 starter templates using your brand context.");
  }


  function scheduleOneWeekFromTemplates() {
    const visibleDrafts = drafts.slice(0, visibleTemplateCount(drafts.length));
    const sourceDrafts = visibleDrafts.length
      ? visibleDrafts
      : savedTemplates
          .slice(0, 5)
          .map((template, index) => draftFromSavedTemplate(template, index));
    if (!sourceDrafts.length) {
      toast.warning("Create templates first. Then schedule your week.");
      setActiveMenu("drafts");
      return;
    }
    const nextPosts = buildScheduledPostsFromDrafts(
      sourceDrafts,
      weeklyPostCount,
      new Date(),
      config?.publish_timezone || DEFAULT_PUBLISH_TIMEZONE,
    );
    setScheduledPosts(nextPosts);
    setPreviewFeedOpen(true);
    setActiveMenu("feed");
    toast.success(`Week planned. Review ${weeklyPostCount} posts below.`);
  }

  const publishTimezone = config?.publish_timezone || DEFAULT_PUBLISH_TIMEZONE;

  function updateScheduledPost(id: string, patch: Partial<ScheduledPost>) {
    setScheduledPosts((current) =>
      current.map((post) => {
        if (post.id !== id) return post;
        const next = { ...post, ...patch };
        if (patch.date !== undefined || patch.time !== undefined) {
          next.scheduledAt = computeScheduledAt(next.date, next.time, publishTimezone);
        }
        return next;
      }),
    );
  }

  async function publishScheduledPostNow(postId: string) {
    if (!tenantId) return;
    setPublishingPostId(postId);
    try {
      const data = await contentApiFetch<{ post?: ScheduledPost; published?: boolean }>(
        "/api/content/publish-scheduled",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenant_id: tenantId, post_id: postId }),
        },
      );
      if (data.post) {
        setScheduledPosts((current) =>
          current.map((post) => (post.id === postId ? data.post! : post)),
        );
        if (data.published) {
          toast.success("Post published.");
        } else {
          toast.error(data.post.lastError || "Publish failed.");
        }
      }
    } catch (err: unknown) {
      toastContentApiError(err, "Publish failed.");
    } finally {
      setPublishingPostId(null);
    }
  }

  async function copyScheduledCaption(post: ScheduledPost) {
    try {
      await navigator.clipboard.writeText(post.caption);
      toast.success("Caption copied.");
    } catch {
      toast.error("Could not copy caption. Select the text manually.");
    }
  }

  function clearScheduledPosts() {
    setScheduledPosts([]);
    setPreviewFeedOpen(false);
    toast.info("Schedule cleared.");
  }

  async function refineTemplatesWithFeedback(feedbackOverride?: string) {
    const feedback = (feedbackOverride ?? templateFeedback).trim();
    const emptyResult = {
      updated: false,
      targetLabel: "the templates",
      draftId: "",
    };
    if (!feedback || drafts.length === 0 || !tenantId) return emptyResult;

    const lower = feedback.toLowerCase();
    const hideLogo =
      /(remove|delete|hide|verwijder|zonder|geen|haal\s+weg|weg)/i.test(
        lower,
      ) && /(logo|logos|logis|wordmark|merknaam)/i.test(lower);
    const cleanAlign =
      /align|aligned|alignment|uitlijn|mooier|clean|netter|strakker/i.test(
        lower,
      );
    const roundedFrames =
      /(rounded|round|corners|corner|afgerond|ronde|rond)/i.test(lower) &&
      /(image|images|frame|frames|slot|slots|afbeelding|foto|photo)/i.test(
        lower,
      );

    const targetIndexes = feedbackTargetIndexes(feedback, drafts.length);
    const targetLabel = feedbackTargetLabel(targetIndexes);
    const currentDrafts = targetIndexes
      .map((index) => drafts[index])
      .filter(Boolean);
    if (currentDrafts.length === 0)
      return { updated: false, targetLabel, draftId: "" };

    setUpdatingTemplateIndexes(targetIndexes);
    const targetTemplateIds = new Set(
      currentDrafts.map((draft) => draft.templateId).filter(Boolean),
    );
    const touchedAt = new Date().toISOString();

    if (hideLogo || cleanAlign || roundedFrames) {
      setDrafts((current) =>
        current.map((draft, index) =>
          targetIndexes.includes(index)
            ? {
                ...draft,
                hideLogo: hideLogo ? true : draft.hideLogo,
                cleanAlign: cleanAlign ? true : draft.cleanAlign,
                roundedFrames: roundedFrames ? true : draft.roundedFrames,
                updatedAt: touchedAt,
              }
            : draft,
        ),
      );
      setSavedTemplates((current) =>
        current.map((template, index) =>
          targetTemplateIds.has(template.id) ||
          (targetTemplateIds.size === 0 && targetIndexes.includes(index))
            ? {
                ...template,
                hideLogo: hideLogo ? true : template.hideLogo,
                cleanAlign: cleanAlign ? true : template.cleanAlign,
                roundedFrames: roundedFrames ? true : template.roundedFrames,
                updatedAt: touchedAt,
              }
            : template,
        ),
      );
    }

    setGenerating(true);
    try {
      const templateBrief = currentDrafts
        .map(
          (draft, index) =>
            `Template ${targetIndexes[index] + 1}. ${draft.title}\n${draft.content}`,
        )
        .join("\n\n");
      const data = await contentApiFetch<{
        drafts?: Array<{
          title?: string;
          type?: string;
          content?: string;
          image_url?: string | null;
          image_error?: string | null;
          visual_prompt?: string | null;
        }>;
      }>("/api/content/agent-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          message: `Refine templates: ${feedback}\n\n${templateBrief}`,
          history: chat
            .slice(-8)
            .map((item) => ({ role: item.role, content: item.text })),
        }),
      });

      const returnedDrafts = Array.isArray(data.drafts)
        ? data.drafts.slice(0, currentDrafts.length)
        : [];
      const refined: Draft[] = currentDrafts.map((currentDraft, index) => {
        const draft = returnedDrafts[index];
        return draft
          ? {
              id: `${Date.now()}-refined-${Math.random().toString(16).slice(2)}`,
              title: String(draft.title || currentDraft.title).slice(0, 140),
              type: String(draft.type || "Template").slice(0, 80),
              content: String(draft.content || currentDraft.content).trim(),
              status: "Draft" as const,
              templateIndex: currentDraft.templateIndex ?? index,
              templateId: currentDraft.templateId,
              hideLogo: hideLogo ? true : currentDraft.hideLogo,
              cleanAlign: cleanAlign ? true : currentDraft.cleanAlign,
              roundedFrames: roundedFrames ? true : currentDraft.roundedFrames,
              imageUrl:
                typeof draft.image_url === "string"
                  ? draft.image_url
                  : currentDraft.imageUrl || null,
              imageError:
                typeof draft.image_error === "string"
                  ? draft.image_error
                  : currentDraft.imageError || null,
              visualPrompt:
                typeof draft.visual_prompt === "string"
                  ? draft.visual_prompt
                  : currentDraft.visualPrompt || null,
            }
          : fallbackRefinedTemplate(
              currentDraft,
              feedback,
              targetIndexes[index],
            );
      });

      if (refined.length) {
        setDrafts((current) =>
          current
            .map((draft, index) => {
              const refinedIndex = targetIndexes.indexOf(index);
              return refinedIndex >= 0 && refined[refinedIndex]
                ? { ...refined[refinedIndex], updatedAt: touchedAt }
                : draft;
            })
            .slice(0, 30),
        );
        setSavedTemplates((current) =>
          current.map((template, index) => {
            const replacement = refined.find(
              (draft) => draft.templateId === template.id,
            );
            return replacement
              ? {
                  ...template,
                  title: replacement.title,
                  content: replacement.content,
                  hideLogo: replacement.hideLogo,
                  cleanAlign: replacement.cleanAlign,
                  roundedFrames: replacement.roundedFrames,
                  manualLayout: replacement.manualLayout,
                  updatedAt: touchedAt,
                }
              : template;
          }),
        );
      }
      setTemplateFeedback("");
      return { updated: true, targetLabel, draftId: refined[0]?.id || "" };
    } catch (err: unknown) {
      toastContentApiError(err, "Template feedback failed.");
      return { updated: false, targetLabel, draftId: "" };
    } finally {
      setGenerating(false);
      setUpdatingTemplateIndexes([]);
    }
  }

  function openManualEditor(draft: Draft, index: number) {
    setEditingDraftId(draft.id);
    setEditingDraftIndex(index);
    setEditingDraftSnapshot({ ...draft });
    setManualEditor(normalizeManualLayout(draft, index));
    setManualEditorSeed((v) => v + 1);
  }

  async function generateFeedFromSavedTemplates() {
    if (!tenantId || savedTemplates.length === 0) return;
    setGenerating(true);
    try {
      const data = await contentApiFetch<{
        drafts?: Array<{
          title?: string;
          content?: string;
          image_url?: string | null;
          image_error?: string | null;
          visual_prompt?: string | null;
        }>;
      }>("/api/content/agent-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          message: buildWeeklyFeedGenerationPrompt({
            weeklyPostCount,
            savedTemplates,
            topic,
            productFocus: config?.product_focus,
          }),
          history: chat
            .slice(-8)
            .map((item) => ({ role: item.role, content: item.text })),
          selected_product: productForGeneration,
          product_catalog: productCatalog,
          ai_image_model: selectedModel,
        }),
      });

      const nextDrafts: Draft[] = Array.isArray(data.drafts)
        ? data.drafts
            .map((draft, index: number) => {
              const template =
                savedTemplates[index % Math.min(savedTemplates.length, 5)];
              const nextDraft: Draft = {
                id: `${Date.now()}-feed-${Math.random().toString(16).slice(2)}`,
                title: String(
                  draft.title || `${template.title} feed post`,
                ).slice(0, 140),
                type: "Feed Post",
                content: String(draft.content || "").trim(),
                status: "Draft" as const,
                imageUrl:
                  typeof draft.image_url === "string" ? draft.image_url : null,
                imageError:
                  typeof draft.image_error === "string"
                    ? draft.image_error
                    : null,
                visualPrompt:
                  typeof draft.visual_prompt === "string"
                    ? draft.visual_prompt
                    : null,
                templateId: template.id,
                templateIndex: template.styleIndex,
                hideLogo: template.hideLogo,
                cleanAlign: template.cleanAlign,
                roundedFrames: template.roundedFrames,
              };
              return {
                ...nextDraft,
                manualLayout: manualLayoutWithFreshCopy(
                  nextDraft,
                  template.styleIndex,
                  template.manualLayout,
                ),
              };
            })
            .filter((draft) => draft.content)
        : [];

      if (nextDrafts.length) {
        const plannedPosts = buildScheduledPostsFromDrafts(
          nextDrafts,
          nextDrafts.length,
          new Date(),
          config?.publish_timezone || DEFAULT_PUBLISH_TIMEZONE,
        );
        setDrafts((current) => [...nextDrafts, ...current].slice(0, 30));
        setScheduledPosts(plannedPosts);
        setSelectedDraftId(nextDrafts[0].id);
        setPreviewFeedOpen(true);
        setActiveMenu("feed");
        const missingImages = nextDrafts.filter(
          (draft) => !hasFinalImage(draft),
        ).length;
        toast.success(
          missingImages
            ? `${nextDrafts.length} weekly posts created. ${missingImages} still need images.`
            : `${nextDrafts.length} weekly posts created with images.`,
        );
      } else {
        toast.warning(
          "No feed posts returned. Try adjusting weekly direction or saved templates.",
        );
      }
    } catch (err: unknown) {
      toastContentApiError(err, "Feed generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  function saveManualEditor(layout: ManualLayout) {
    if (!editingDraftId) return;
    const saved = migrateManualLayout(layout);
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === editingDraftId
          ? {
              ...draft,
              manualLayout: saved,
              updatedAt: new Date().toISOString(),
            }
          : draft,
      ),
    );
    setSavedTemplates((current) =>
      current.map((template) =>
        template.id === drafts.find((d) => d.id === editingDraftId)?.templateId
          ? {
              ...template,
              manualLayout: saved,
              updatedAt: new Date().toISOString(),
            }
          : template,
      ),
    );
    setManualEditor(null);
    setEditingDraftId("");
    toast.success("Manual layout saved.");
  }

  async function saveConfig() {
    if (!tenantId || !config) return;
    const outputTypes = config.output_types || [];
    if (outputTypes.length === 0) {
      toast.error("Select at least one active content output.");
      return;
    }
    const publishPlatforms = config.publish_platforms || [];
    if (config.publishing_enabled !== false && publishPlatforms.length === 0) {
      toast.error(
        "Choose at least one publishing target, or turn off direct publishing.",
      );
      return;
    }
    setSaving(true);
    try {
      const data = await contentApiFetch<{ config?: ContentConfig }>(
        "/api/content/config",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenant_id: tenantId, ...config }),
        },
      );
      if (data.config) {
        setConfig(data.config);
        setConfigBaseline(data.config);
        if (data.config.ai_image_model) {
          setSelectedModel(getContentImageModel(data.config.ai_image_model).id);
        }
      }
      toast.success("Studio settings saved.");
    } catch (err: unknown) {
      toastContentApiError(err, "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  function updateManualEditor(key: string, value: unknown) {
    setManualEditor((c) => (c ? { ...c, [key]: value } : c));
  }

  // --- Effects (Preserving Lifecycle) ---

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const fresh = await fetchSession();
        if (!alive) return;
        setSession(fresh);
        const ids = Array.from(
          new Set([fresh?.tenantId, fresh?.email].filter(Boolean) as string[]),
        );

        const configs = await Promise.all(
          ids.map((id) =>
            fetch(
              `/api/content/config?tenant_id=${encodeURIComponent(id)}`,
            ).then((res) => (res.ok ? res.json() : { config: null })),
          ),
        );
        if (!alive) return;
        const nextConfig = configs.find((item) => item.config)?.config || null;
        setConfig(nextConfig);
        setConfigBaseline(nextConfig);
        if (nextConfig?.ai_image_model) {
          setSelectedModel(getContentImageModel(nextConfig.ai_image_model).id);
        }

        const profileResults = await Promise.all(
          ids.map((id) =>
            fetch(
              `/api/settings/brand-profile?tenant_id=${encodeURIComponent(id)}`,
            ).then((res) => (res.ok ? res.json() : { profile: null })),
          ),
        );
        if (!alive) return;
        setBrandProfile(
          profileResults.find((item) => item.profile)?.profile || null,
        );

        const keyId = fresh?.tenantId || fresh?.email || "default";
        const tenantForServer = fresh?.tenantId || fresh?.email || "";

        let serverState: any = null;
        if (tenantForServer) {
          const res = await fetch(
            `/api/content/studio-state?tenant_id=${encodeURIComponent(tenantForServer)}`,
          );
          if (res.ok) {
            const data = await res.json().catch(() => ({ state: null }));
            serverState = data?.state || null;
          }
        }
        if (!alive) return;

        if (serverState) {
          if (Array.isArray(serverState.drafts)) setDrafts(serverState.drafts);
          if (Array.isArray(serverState.chat) && serverState.chat.length)
            setChat(serverState.chat);
          if (Array.isArray(serverState.savedTemplates))
            setSavedTemplates(serverState.savedTemplates);
          if (Array.isArray(serverState.scheduledPosts)) {
            setScheduledPosts(
              migrateScheduledPosts(
                serverState.scheduledPosts,
                nextConfig?.publish_timezone || DEFAULT_PUBLISH_TIMEZONE,
              ),
            );
          }
          if (serverState.weeklyPostCount)
            setWeeklyPostCount(serverState.weeklyPostCount);
          if (serverState.activeMenu) setActiveMenu(serverState.activeMenu);
          if (typeof serverState.topic === "string")
            setTopic(serverState.topic);
          if (typeof serverState.product === "string")
            setProduct(serverState.product);
          skipNextServerSaveRef.current = true;
        }

        hydratedRef.current = true;
        setStorageKey(keyId);
        setStorageReady(true);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!config?.ai_image_model) return;
    const resolved = getContentImageModel(config.ai_image_model).id;
    setSelectedModel((current) => (current === resolved ? current : resolved));
  }, [config?.ai_image_model]);

  useEffect(() => {
    if (!storageReady || !hydratedRef.current || !tenantId) return;
    if (skipNextServerSaveRef.current) {
      skipNextServerSaveRef.current = false;
      return;
    }

    const payload = {
      chat,
      drafts,
      savedTemplates,
      scheduledPosts,
      weeklyPostCount,
      activeMenu,
      topic,
      product,
    };
    const serialized = JSON.stringify(payload);
    if (serialized === lastServerSaveRef.current) return;

    const timer = setTimeout(() => {
      lastServerSaveRef.current = serialized;
      setStudioSyncStatus("saving");
      fetch("/api/content/studio-state", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, state: payload }),
      })
        .then(async (res) => {
          if (res.ok) {
            setStudioSyncStatus("saved");
            return;
          }
          const body = await res.json().catch(() => ({}));
          lastServerSaveRef.current = "";
          setStudioSyncStatus("error");
          if (body?.error) toast.error(body.error);
        })
        .catch(() => {
          lastServerSaveRef.current = "";
          setStudioSyncStatus("error");
        });
    }, 800);
    return () => clearTimeout(timer);
  }, [
    chat,
    drafts,
    savedTemplates,
    scheduledPosts,
    weeklyPostCount,
    activeMenu,
    topic,
    product,
    tenantId,
    storageReady,
  ]);

  // --- Render Logic ---

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-b-2 border-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!config || config.status !== "active") {
    return (
      <Card className="max-w-2xl mx-auto rounded-[28px] border-blue-100 shadow-sm p-8">
        <Badge variant="outline" className="mb-3 text-blue-600 border-blue-200">
          Content Studio
        </Badge>
        <CardTitle className="text-2xl font-bold">
          Set up Content Studio first
        </CardTitle>
        <CardDescription className="mt-2 text-gray-600">
          Connect and configure Content Studio before using it.
        </CardDescription>
        <Button
          asChild
          className="mt-6 bg-blue-600 hover:bg-blue-700 rounded-xl"
        >
          <Link href="/dashboard/automations/content-pipeline">Open setup</Link>
        </Button>
      </Card>
    );
  }

  const mainTabs = [
    {
      id: "agent" as const,
      label: "Agent Chat",
      shortLabel: "Chat",
      icon: MessageSquare,
    },
    {
      id: "drafts" as const,
      label: "Templates",
      icon: LayoutTemplate,
      badge: savedTemplates.length || undefined,
    },
    {
      id: "feed" as const,
      label: "Planner",
      icon: Calendar,
      badge: scheduledPosts.length || undefined,
    },
    {
      id: "settings" as const,
      label: "Studio Settings",
      shortLabel: "Settings",
      icon: Settings,
    },
  ];

  return (
    <div className="min-w-0 mx-auto space-y-6 max-w-7xl">
      <div className="flex min-w-0 flex-col gap-5 rounded-[24px] border border-gray-100 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] sm:p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <h1 className="text-2xl font-black tracking-tight text-gray-900">
                Content Studio
              </h1>
              <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-none text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md">
                Active App
              </Badge>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-gray-500">
              Pick a product, ask for posts, and the AI uses your brand data
              plus webshop catalog to craft perfect content.
            </p>
          </div>

          <div className="shrink-0">
            <Button
              asChild
              variant="outline"
              className="h-10 px-5 text-sm font-semibold text-gray-700 bg-white border-gray-200 shadow-sm rounded-xl hover:bg-gray-50"
            >
              <Link href="/dashboard/automations/content-pipeline">
                <Settings className="w-4 h-4 mr-2 text-gray-500" />
                Configure
              </Link>
            </Button>
          </div>
        </div>

        <PillTabBar
          tabs={mainTabs}
          activeId={activeMenu}
          onChange={setActiveMenu}
          ariaLabel="Content Studio"
          className="mb-0 sm:mb-0"
        />
      </div>

      <div className="min-h-0 xl:min-h-[600px]">
        {activeMenu === "agent" && (
          <div className="flex flex-col gap-4 xl:grid xl:h-[720px] xl:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] xl:gap-6">
            <div className="flex min-h-[min(72dvh,720px)] min-w-0 flex-col xl:h-full xl:min-h-0">
              <ChatInterface
                chat={chat}
                agentInput={agentInput}
                generating={generating}
                generatingPhase={generatingPhase}
                nextActions={nextActions}
                productForGeneration={productForGeneration}
                onInputChange={setAgentInput}
                onSendMessage={sendAgentMessage}
                onAnswerClarification={(question) => {
                  setAgentInput(`Re: ${question}\n`);
                }}
                onResetChat={resetChat}
                onSelectDraft={setSelectedDraftId}
                onSetActiveMenu={setActiveMenu}
                onSetTemplateFeedback={setTemplateFeedback}
                drafts={drafts}
                draftsCount={drafts.length}
                productCatalog={productCatalog}
                product={product}
                setProduct={setProduct}
                productCount={productCount}
                estimatedChatNomi={pendingSendEstimate.chatNomi}
                estimatedImageNomi={pendingSendEstimate.imageNomi}
                selectedModelLabel={selectedImageModel.label}
                studioSyncStatus={studioSyncStatus}
                onGenerateVisual={generateDraftVisual}
                onUpdateVisualPrompt={updateDraftVisualPrompt}
                generatingVisualDraftIds={generatingVisualDraftIds}
                onSaveTemplate={saveDraftToTemplates}
                savedTemplates={savedTemplates}
              />
            </div>

            <aside className="min-w-0 shrink-0 xl:h-full xl:overflow-y-auto xl:pr-2 xl:no-scrollbar">
              <QuickActions
                productForGeneration={productForGeneration}
                product={product}
                onSendMessage={sendAgentMessage}
              />
            </aside>
          </div>
        )}

        {activeMenu === "drafts" && (
          <TemplatesTab
            drafts={drafts}
            setDrafts={setDrafts}
            scheduleOneWeekFromTemplates={scheduleOneWeekFromTemplates}
            templateFeedback={templateFeedback}
            setTemplateFeedback={setTemplateFeedback}
            generating={generating}
            refineTemplatesWithFeedback={refineTemplatesWithFeedback}
            updatingTemplateIndexes={updatingTemplateIndexes}
            config={config}
            brandProfile={brandProfile}
            openManualEditor={openManualEditor}
            sendAgentMessage={sendAgentMessage}
            generatingVisualDraftIds={generatingVisualDraftIds}
            onGenerateVisual={generateDraftVisual}
            imageActionNomi={estimatedAiCreativeNomiForImages(1, selectedModel)}
            onUpdateVisualPrompt={updateDraftVisualPrompt}
            onSaveTemplate={saveDraftToTemplates}
            onDeleteTemplate={deleteSavedTemplate}
            savedTemplates={savedTemplates}
          />
        )}

        {activeMenu === "feed" && (
          <PlannerTab
            weeklyPostCount={weeklyPostCount}
            setWeeklyPostCount={setWeeklyPostCount}
            topic={topic}
            setTopic={setTopic}
            generateWeeklyDirection={generateWeeklyDirection}
            generating={generating}
            visibleDraftCount={visibleTemplateCount(drafts.length)}
            savedTemplates={savedTemplates}
            generateFeedFromSavedTemplates={generateFeedFromSavedTemplates}
            scheduleOneWeekFromTemplates={scheduleOneWeekFromTemplates}
            scheduledPosts={scheduledPosts}
            updateScheduledPost={updateScheduledPost}
            copyScheduledCaption={copyScheduledCaption}
            publishScheduledPostNow={publishScheduledPostNow}
            publishingPostId={publishingPostId}
            clearScheduledPosts={clearScheduledPosts}
            onOpenPreviewFeed={() => setPreviewFeedOpen(true)}
            previewFeedOpen={previewFeedOpen}
            onClosePreviewFeed={() => setPreviewFeedOpen(false)}
            openManualEditor={openManualEditor}
            onClearTemplateLibrary={() => setSavedTemplates([])}
            onSeedDefaultTemplates={seedDefaultTemplates}
            config={config}
            brandProfile={brandProfile}
          />
        )}

        {activeMenu === "settings" && (
          <Card className="rounded-[24px] border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] bg-white overflow-hidden">
            <CardHeader className="p-6 border-b border-gray-50 bg-gray-50/50">
              <div className="flex items-center gap-3 mb-1">
                <Settings className="w-5 h-5 text-blue-600" />
                <CardTitle className="text-xl font-bold tracking-tight text-gray-900">
                  Studio Settings
                </CardTitle>
              </div>
              <CardDescription className="text-sm text-gray-500">
                Update brand voice, generation strategy, outputs, and publishing
                without rerunning onboarding.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 md:p-8">
              <StudioSettings
                config={config}
                savedConfig={configBaseline}
                onUpdate={(next) =>
                  setConfig((prev) =>
                    prev ? { ...prev, ...next } : (next as ContentConfig),
                  )
                }
                onSave={saveConfig}
                saving={saving}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modals & Overlays */}
      <ManualEditor
        open={Boolean(manualEditor)}
        onOpenChange={(open) => !open && setManualEditor(null)}
        draft={drafts.find((d) => d.id === editingDraftId) || null}
        index={editingDraftIndex}
        tenantId={tenantId}
        manualEditor={manualEditor}
        layoutSeed={manualEditorSeed}
        config={config}
        brandProfile={brandProfile}
        onUpdateManualEditor={updateManualEditor}
        onDeleteManualSection={(key) =>
          setManualEditor((c) => (c ? { ...c, [key]: false } : c))
        }
        onRestoreManualSection={(key) =>
          setManualEditor((c) => (c ? { ...c, [key]: true } : c))
        }
        onSave={saveManualEditor}
        onReset={() => {
          const d = drafts.find((item) => item.id === editingDraftId);
          if (d) {
            setManualEditor(
              migrateManualLayout(manualLayoutFromDraft(d, editingDraftIndex)),
            );
            setManualEditorSeed((v) => v + 1);
          }
        }}
      />
    </div>
  );
}
