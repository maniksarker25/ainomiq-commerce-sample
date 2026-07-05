"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import type {
  Campaign,
  MetaAdset,
  PersonaSuggestion,
  ProductFolder,
  StrategistChatMessage,
  StrategistResponse,
} from "../types";
import LogicChatPanel from "./LogicChatPanel";
import PostAdsFormPanel from "./PostAdsFormPanel";

export type ChatPostAdsTabProps = {
  activeTab: "chat" | "post-ads";
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
  landingOptionsFor: (products: ProductFolder[]) => Array<{ label: string; url: string }>;
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
  selectedCatalogLabel: string;
  hasCampaignContext: boolean;
  strategistError: string | null;
  campaignMode: "existing" | "new";
  selectedCampaignId: string;
  activeCampaigns: Campaign[];
  newCampaignName: string;
  setNewCampaignName: Dispatch<SetStateAction<string>>;
  newCampaignObjective: string;
  setNewCampaignObjective: Dispatch<SetStateAction<string>>;
  newCampaignBuyingType: string;
  setNewCampaignBuyingType: Dispatch<SetStateAction<string>>;
  newCampaignStatus: string;
  setNewCampaignStatus: Dispatch<SetStateAction<string>>;
  newCampaignBudgetMode: "campaign" | "adset";
  setNewCampaignBudgetMode: Dispatch<SetStateAction<"campaign" | "adset">>;
  newCampaignBudgetType: "daily" | "lifetime";
  setNewCampaignBudgetType: Dispatch<SetStateAction<"daily" | "lifetime">>;
  newCampaignBudget: string;
  setNewCampaignBudget: Dispatch<SetStateAction<string>>;
  newCampaignBidStrategy: string;
  setNewCampaignBidStrategy: Dispatch<SetStateAction<string>>;
  newCampaignOptimizationGoal: string;
  setNewCampaignOptimizationGoal: Dispatch<SetStateAction<string>>;
  newCampaignBidAmount: string;
  setNewCampaignBidAmount: Dispatch<SetStateAction<string>>;
  newCampaignSpendLimit: string;
  setNewCampaignSpendLimit: Dispatch<SetStateAction<string>>;
  newCampaignStartDate: string;
  setNewCampaignStartDate: Dispatch<SetStateAction<string>>;
  newCampaignEndDate: string;
  setNewCampaignEndDate: Dispatch<SetStateAction<string>>;
  newCampaignAttribution: string;
  setNewCampaignAttribution: Dispatch<SetStateAction<string>>;
  newCampaignSpecialAdCategory: string;
  setNewCampaignSpecialAdCategory: Dispatch<SetStateAction<string>>;
  newCampaignMarkets: string;
  setNewCampaignMarkets: Dispatch<SetStateAction<string>>;
  newCampaignAbTest: boolean;
  setNewCampaignAbTest: Dispatch<SetStateAction<boolean>>;
  draftGoal: string;
  setDraftGoal: Dispatch<SetStateAction<string>>;
  mediaFormatLabel: string;
  creativeMediaTypes: string[];
  setCreativeMediaTypeSelection: (value: string) => void;
  creativeAspectRatio: string;
  updateTemplateFormat: (ratio: string) => void;
  catalogSearchQuery: string;
  setCatalogSearchQuery: Dispatch<SetStateAction<string>>;
  visibleCatalogItems: ProductFolder[];
  selectedProductIds: string[];
  hasLinkedDriveContent: (item: ProductFolder) => boolean;
  personaCountForProduct: (item: ProductFolder) => number;
  catalogSearchTerm: string;
  targetingMode: "custom" | "copy";
  setTargetingMode: Dispatch<SetStateAction<"custom" | "copy">>;
  selectedTemplateAdsetId: string;
  setSelectedTemplateAdsetId: Dispatch<SetStateAction<string>>;
  adsetsLoading: boolean;
  existingAdsets: MetaAdset[];
  adsetsError: string | null;
  selectedTemplateAdset: MetaAdset | null | undefined;
  customTargetCountries: string;
  setCustomTargetCountries: Dispatch<SetStateAction<string>>;
  customTargetAgeMin: number;
  setCustomTargetAgeMin: Dispatch<SetStateAction<number>>;
  customTargetAgeMax: number;
  setCustomTargetAgeMax: Dispatch<SetStateAction<number>>;
  customTargetGender: "all" | "women" | "men";
  setCustomTargetGender: Dispatch<SetStateAction<"all" | "women" | "men">>;
  selectedPersonaPool: PersonaSuggestion[];
  adsPerAdSet: number;
  setAdsPerAdSet: Dispatch<SetStateAction<number>>;
  adSetCount: number;
  requestedCreativeCount: number;
  displayedPersonaSuggestions: PersonaSuggestion[];
  effectiveSelectedPersonaIds: string[];
  setSelectedPersonaId: Dispatch<SetStateAction<string>>;
  setSelectedPersonaIds: Dispatch<SetStateAction<string[]>>;
  onOpenPersonasTab: () => void;
  strategistResult: StrategistResponse | null;
  busy: string | null;
  onBuildBatch: () => void;
  batchProgressStep: number;
  latestCreatedBatch: { id: string; name: string; count: number } | null;
  onOpenReviewTab: () => void;
};

export default function ChatPostAdsTab(props: ChatPostAdsTabProps) {
  const {
    activeTab,
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
    selectedCatalogLabel,
    hasCampaignContext,
    strategistError,
    campaignMode,
    selectedCampaignId,
    activeCampaigns,
    newCampaignName,
    setNewCampaignName,
    newCampaignObjective,
    setNewCampaignObjective,
    newCampaignBuyingType,
    setNewCampaignBuyingType,
    newCampaignStatus,
    setNewCampaignStatus,
    newCampaignBudgetMode,
    setNewCampaignBudgetMode,
    newCampaignBudgetType,
    setNewCampaignBudgetType,
    newCampaignBudget,
    setNewCampaignBudget,
    newCampaignBidStrategy,
    setNewCampaignBidStrategy,
    newCampaignOptimizationGoal,
    setNewCampaignOptimizationGoal,
    newCampaignBidAmount,
    setNewCampaignBidAmount,
    newCampaignSpendLimit,
    setNewCampaignSpendLimit,
    newCampaignStartDate,
    setNewCampaignStartDate,
    newCampaignEndDate,
    setNewCampaignEndDate,
    newCampaignAttribution,
    setNewCampaignAttribution,
    newCampaignSpecialAdCategory,
    setNewCampaignSpecialAdCategory,
    newCampaignMarkets,
    setNewCampaignMarkets,
    newCampaignAbTest,
    setNewCampaignAbTest,
    draftGoal,
    setDraftGoal,
    mediaFormatLabel,
    creativeMediaTypes,
    setCreativeMediaTypeSelection,
    creativeAspectRatio,
    updateTemplateFormat,
    catalogSearchQuery,
    setCatalogSearchQuery,
    visibleCatalogItems,
    selectedProductIds,
    hasLinkedDriveContent,
    personaCountForProduct,
    catalogSearchTerm,
    targetingMode,
    setTargetingMode,
    selectedTemplateAdsetId,
    setSelectedTemplateAdsetId,
    adsetsLoading,
    existingAdsets,
    adsetsError,
    selectedTemplateAdset,
    customTargetCountries,
    setCustomTargetCountries,
    customTargetAgeMin,
    setCustomTargetAgeMin,
    customTargetAgeMax,
    setCustomTargetAgeMax,
    customTargetGender,
    setCustomTargetGender,
    selectedPersonaPool,
    adsPerAdSet,
    setAdsPerAdSet,
    adSetCount,
    requestedCreativeCount,
    displayedPersonaSuggestions,
    effectiveSelectedPersonaIds,
    setSelectedPersonaId,
    setSelectedPersonaIds,
    onOpenPersonasTab,
    strategistResult,
    busy,
    onBuildBatch,
    batchProgressStep,
    latestCreatedBatch,
    onOpenReviewTab,
  } = props;

  return (
    <>
      {activeTab === "chat" ? (
        <LogicChatPanel
          hasBrandScrape={hasBrandScrape}
          brandDataScanHref={brandDataScanHref}
          strategistListRef={strategistListRef}
          strategistScrollTargetRef={strategistScrollTargetRef}
          strategistMessages={strategistMessages}
          setStrategistMessages={setStrategistMessages}
          strategistLoading={strategistLoading}
          strategistCreating={strategistCreating}
          productCatalogItems={productCatalogItems}
          selectedCatalogItems={selectedCatalogItems}
          landingOptionsFor={landingOptionsFor}
          setSelectedProductIds={setSelectedProductIds}
          setDestinationUrl={setDestinationUrl}
          askStrategist={askStrategist}
          setCampaignMode={setCampaignMode}
          setSelectedCampaignId={setSelectedCampaignId}
          setStickyStrategistCampaign={setStickyStrategistCampaign}
          createPromptForMessage={createPromptForMessage}
          messageHasCreateCta={messageHasCreateCta}
          strategistQuickPrompts={strategistQuickPrompts}
          logicChatNeedsMoreNomi={logicChatNeedsMoreNomi}
          logicChatUsesNomi={logicChatUsesNomi}
          logicChatNomiCost={logicChatNomiCost}
          nomiBalance={nomiBalance}
          strategistPrompt={strategistPrompt}
          setStrategistPrompt={setStrategistPrompt}
          selectedCatalogCount={selectedCatalogCount}
          hasCampaignContext={hasCampaignContext}
          strategistError={strategistError}
        />
      ) : (
        <PostAdsFormPanel
          hasBrandScrape={hasBrandScrape}
          brandDataScanHref={brandDataScanHref}
          campaignMode={campaignMode}
          onCampaignModeChange={setCampaignMode}
          selectedCampaignId={selectedCampaignId}
          onSelectedCampaignIdChange={setSelectedCampaignId}
          activeCampaigns={activeCampaigns}
          newCampaignName={newCampaignName}
          onNewCampaignNameChange={setNewCampaignName}
          newCampaignObjective={newCampaignObjective}
          onNewCampaignObjectiveChange={setNewCampaignObjective}
          newCampaignBuyingType={newCampaignBuyingType}
          onNewCampaignBuyingTypeChange={setNewCampaignBuyingType}
          newCampaignStatus={newCampaignStatus}
          onNewCampaignStatusChange={setNewCampaignStatus}
          newCampaignBudgetMode={newCampaignBudgetMode}
          onNewCampaignBudgetModeChange={setNewCampaignBudgetMode}
          newCampaignBudgetType={newCampaignBudgetType}
          onNewCampaignBudgetTypeChange={setNewCampaignBudgetType}
          newCampaignBudget={newCampaignBudget}
          onNewCampaignBudgetChange={setNewCampaignBudget}
          newCampaignBidStrategy={newCampaignBidStrategy}
          onNewCampaignBidStrategyChange={setNewCampaignBidStrategy}
          newCampaignOptimizationGoal={newCampaignOptimizationGoal}
          onNewCampaignOptimizationGoalChange={setNewCampaignOptimizationGoal}
          newCampaignBidAmount={newCampaignBidAmount}
          onNewCampaignBidAmountChange={setNewCampaignBidAmount}
          newCampaignSpendLimit={newCampaignSpendLimit}
          onNewCampaignSpendLimitChange={setNewCampaignSpendLimit}
          newCampaignStartDate={newCampaignStartDate}
          onNewCampaignStartDateChange={setNewCampaignStartDate}
          newCampaignEndDate={newCampaignEndDate}
          onNewCampaignEndDateChange={setNewCampaignEndDate}
          newCampaignAttribution={newCampaignAttribution}
          onNewCampaignAttributionChange={setNewCampaignAttribution}
          newCampaignSpecialAdCategory={newCampaignSpecialAdCategory}
          onNewCampaignSpecialAdCategoryChange={setNewCampaignSpecialAdCategory}
          newCampaignMarkets={newCampaignMarkets}
          onNewCampaignMarketsChange={setNewCampaignMarkets}
          newCampaignAbTest={newCampaignAbTest}
          onNewCampaignAbTestChange={setNewCampaignAbTest}
          draftGoal={draftGoal}
          onDraftGoalChange={setDraftGoal}
          mediaFormatLabel={mediaFormatLabel}
          creativeMediaTypes={creativeMediaTypes}
          onCreativeMediaTypeSelection={setCreativeMediaTypeSelection}
          creativeAspectRatio={creativeAspectRatio}
          onUpdateTemplateFormat={updateTemplateFormat}
          catalogSearchQuery={catalogSearchQuery}
          onCatalogSearchQueryChange={setCatalogSearchQuery}
          visibleCatalogItems={visibleCatalogItems}
          selectedProductIds={selectedProductIds}
          onToggleProduct={(productId) => setSelectedProductIds(current => current.includes(productId) ? current.filter(id => id !== productId) : [...current, productId])}
          selectedCatalogCount={selectedCatalogCount}
          selectedCatalogLabel={selectedCatalogLabel}
          hasLinkedDriveContent={hasLinkedDriveContent}
          personaCountForProduct={personaCountForProduct}
          catalogSearchTerm={catalogSearchTerm}
          targetingMode={targetingMode}
          onTargetingModeChange={setTargetingMode}
          selectedTemplateAdsetId={selectedTemplateAdsetId}
          onSelectedTemplateAdsetIdChange={setSelectedTemplateAdsetId}
          adsetsLoading={adsetsLoading}
          existingAdsets={existingAdsets}
          adsetsError={adsetsError}
          selectedTemplateAdset={selectedTemplateAdset}
          customTargetCountries={customTargetCountries}
          onCustomTargetCountriesChange={setCustomTargetCountries}
          customTargetAgeMin={customTargetAgeMin}
          onCustomTargetAgeMinChange={setCustomTargetAgeMin}
          customTargetAgeMax={customTargetAgeMax}
          onCustomTargetAgeMaxChange={setCustomTargetAgeMax}
          customTargetGender={customTargetGender}
          onCustomTargetGenderChange={setCustomTargetGender}
          selectedPersonaPool={selectedPersonaPool}
          adsPerAdSet={adsPerAdSet}
          onAdsPerAdSetChange={setAdsPerAdSet}
          adSetCount={adSetCount}
          requestedCreativeCount={requestedCreativeCount}
          displayedPersonaSuggestions={displayedPersonaSuggestions}
          effectiveSelectedPersonaIds={effectiveSelectedPersonaIds}
          onSelectPersona={(personaId) => {
            setSelectedPersonaId(personaId);
            setSelectedPersonaIds(current => {
              const next = current.includes(personaId)
                ? current.filter(id => id !== personaId)
                : [...current, personaId].slice(0, 4);
              return next.length ? next : [personaId];
            });
          }}
          onOpenPersonasTab={onOpenPersonasTab}
          strategistResult={strategistResult}
          busy={busy}
          hasCampaignContext={hasCampaignContext}
          onBuildBatch={onBuildBatch}
          batchProgressStep={batchProgressStep}
          latestCreatedBatch={latestCreatedBatch}
          onOpenReviewTab={onOpenReviewTab}
        />
      )}
    </>
  );
}
