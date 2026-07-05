"use client";

import type { DbRow, Overview } from "../types";
import { countLabels } from "../types";
import { getCreativePreview, ratioClass } from "../lib/creative-preview";
import {
  PlanSummary,
  formatLocalDateTime,
  RecommendationList,
  RowList,
  SplitLists,
  PublishJobTracker,
} from "./ReviewComponents";
import { EmptyState, Gate, Panel } from "./CoreUI";

export type ResultsTabProps = {
  tenantId: string;
  busy: string | null;
  overview: Overview | null;
  selectedReviewBatch: DbRow | null;
  reviewDraftPickerId: string;
  onReviewDraftPickerIdChange: (value: string) => void;
  reviewDraftOptions: DbRow[];
  onOpenReviewDraft: () => void;
  onRequestDeleteReviewDraft: () => void;
  pendingDeleteReviewBatchId: string | null;
  reviewDraftPickerBatch: DbRow | null;
  onCancelDeleteReviewDraft: () => void;
  onConfirmDeleteReviewDraft: () => void;
  selectedReviewBatchId: string;
  onClearReviewBatchFilter: () => void;
  reviewCreatives: DbRow[];
  onCreativeQc: (creativeId: string | number, status: "approved" | "rejected") => void;
  planCreatives: DbRow[];
  firstCreative: DbRow | undefined;
  onCreatePlanCopy: () => void;
  destinationUrl: string;
  onDestinationUrlChange: (value: string) => void;
  onSavePlanDestination: () => void;
  firstPlan: DbRow | undefined;
  onContinueToCopyUrl: () => void;
  planApprovalBlocked: boolean;
  copyDestinationBlockers: string[];
  onApprovePlan: () => void;
  onApprovePlanCreatives: () => void;
  onRunApprovedAds: () => void;
  onRetryPublish: (jobId: string) => void;
  retryBusyId: string | null;
};

export default function ResultsTab({
  busy,
  overview,
  selectedReviewBatch,
  reviewDraftPickerId,
  onReviewDraftPickerIdChange,
  reviewDraftOptions,
  onOpenReviewDraft,
  onRequestDeleteReviewDraft,
  pendingDeleteReviewBatchId,
  reviewDraftPickerBatch,
  onCancelDeleteReviewDraft,
  onConfirmDeleteReviewDraft,
  selectedReviewBatchId,
  onClearReviewBatchFilter,
  reviewCreatives,
  onCreativeQc,
  planCreatives,
  firstCreative,
  onCreatePlanCopy,
  destinationUrl,
  onDestinationUrlChange,
  onSavePlanDestination,
  firstPlan,
  onContinueToCopyUrl,
  planApprovalBlocked,
  copyDestinationBlockers,
  onApprovePlan,
  onApprovePlanCreatives,
  onRunApprovedAds,
  onRetryPublish,
  retryBusyId,
}: ResultsTabProps) {
  return (
    <>
<Panel title="Review generated ads">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600">This step reviews the creatives produced by Create ads. Approve assets that are ready for Meta, or delete anything that should not run.</p>
                      {selectedReviewBatch ? (
                        <p className="mt-2 text-xs font-semibold text-blue-700">Showing batch: {String(selectedReviewBatch.name || selectedReviewBatch.id)} · {formatLocalDateTime(selectedReviewBatch.created_at)}</p>
                      ) : null}
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                        <label className="space-y-2">
                          <span className="text-sm font-semibold text-gray-950">Draft batch</span>
                          <select
                            value={reviewDraftPickerId}
                            onChange={event => onReviewDraftPickerIdChange(event.target.value)}
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
                          >
                            <option value="">Choose a draft batch</option>
                            {reviewDraftOptions.map(batch => (
                              <option key={String(batch.id)} value={String(batch.id)}>
                                {String(batch.name || batch.id)} - {formatLocalDateTime(batch.created_at)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          disabled={!reviewDraftPickerId}
                          onClick={onOpenReviewDraft}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          Open draft
                        </button>
                        <button
                          type="button"
                          disabled={!reviewDraftPickerId || Boolean(busy)}
                          onClick={onRequestDeleteReviewDraft}
                          className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Delete draft
                        </button>
                      </div>
                      {pendingDeleteReviewBatchId && reviewDraftPickerBatch ? (
                        <div className="mt-3 flex flex-col gap-3 rounded-lg border border-red-100 bg-white p-3 text-sm md:flex-row md:items-center md:justify-between">
                          <div className="text-red-900">
                            Delete <span className="font-semibold">{String(reviewDraftPickerBatch.name || reviewDraftPickerBatch.id)}</span>? This removes the draft batch and its generated ads.
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={onCancelDeleteReviewDraft} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                            <button
                              type="button"
                              disabled={Boolean(busy)}
                              onClick={onConfirmDeleteReviewDraft}
                              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {selectedReviewBatchId ? (
                        <button type="button" onClick={onClearReviewBatchFilter} className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">Show all ads</button>
                      ) : null}
                    </div>
                  </div>
                  {reviewCreatives.length ? (
                    <div className="space-y-3">
                      {reviewCreatives.map(creative => {
                        const preview = getCreativePreview(creative);
                        return (
                          <div key={String(creative.id)} className="rounded-xl border border-gray-200 bg-white p-4">
                            <div className="grid gap-4 lg:grid-cols-[minmax(240px,420px)_1fr]">
                              <div className={`${ratioClass(preview.ratio)} w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50`}>
                                {preview.imageUrl && preview.mediaType === 'video' ? (
                                  <video src={preview.imageUrl} controls className="h-full w-full object-contain" />
                                ) : preview.imageUrl ? (
                                  <img src={preview.imageUrl} alt={preview.title} className="h-full w-full object-contain" />
                                ) : (
                                  <div className="flex h-full items-center justify-center px-6 text-center text-sm font-semibold text-gray-500">Media unavailable. Replace this asset in Creative Library.</div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-950">{preview.title}</div>
                                <div className="text-sm text-gray-600 mt-1">{preview.subtitle}</div>
                                <div className="mt-3 grid gap-2 text-xs text-gray-600">
                                  <div><span className="font-semibold text-gray-900">Source:</span> {preview.source}</div>
                                  <div><span className="font-semibold text-gray-900">Media:</span> {preview.mediaType} · {preview.ratio}</div>
                                  <div><span className="font-semibold text-gray-900">Product:</span> {preview.productName || 'Not assigned'}</div>
                                  <div><span className="font-semibold text-gray-900">Persona:</span> {preview.personaName || 'Not assigned'}</div>
                                  <div><span className="font-semibold text-gray-900">Status:</span> {String(creative.status || 'generated')} · {String(creative.qc_status || 'unchecked')}</div>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-3">
                                  {[
                                    { status: 'approved', label: 'Approve' },
                                    { status: 'rejected', label: 'Delete' },
                                  ].map(action => (
                                    <button
                                      key={action.status}
                                      disabled={Boolean(busy)}
                                      onClick={() => creative.id != null && onCreativeQc(creative.id, action.status as 'approved' | 'rejected')}
                                      className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                      {action.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : <EmptyState text={selectedReviewBatchId ? "No creatives found for this batch yet. Refresh once, or build the batch again if no ads were generated." : "No creatives yet. Go to Create ads, select a campaign and products, then create the ad package."} />}
                </Panel>

<Panel title="Copy and destination">
                  {(planCreatives.length || firstCreative) ? (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950">
                        <div className="font-semibold">Latest plan handoff</div>
                        <p className="mt-1">Preparing <span className="font-semibold">{planCreatives.length || 1}</span> creative{(planCreatives.length || 1) === 1 ? '' : 's'} from the latest plan. This step must be completed before approval and run.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          disabled={Boolean(busy)}
                          onClick={onCreatePlanCopy}
                          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
                        >
                          Create selected copy for plan
                        </button>
                      </div>
                      <div className="flex flex-col md:flex-row gap-2">
                        <input
                          value={destinationUrl}
                          onChange={event => onDestinationUrlChange(event.target.value)}
                          placeholder="https://example.com/products/jeans-pin"
                          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                        <button
                          disabled={Boolean(busy) || !destinationUrl.trim()}
                          onClick={onSavePlanDestination}
                          className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Save destination for plan
                        </button>
                      </div>
                      <SplitLists
                        leftTitle="Selected copy"
                        leftRows={overview?.latestCopyVariants || []}
                        leftEmpty="No selected copy yet. Use the button above to create selected copy for the latest plan."
                        rightTitle="Destination URLs"
                        rightRows={overview?.latestDestinations || []}
                        rightEmpty="No destination URLs yet. Save the landing page URL for this plan."
                      />
                    </div>
                  ) : <EmptyState text="No plan creatives are ready yet. Create ads first, then return here for copy and URL setup." />}
                </Panel>

<Panel title="Ad set plan">
                  {firstPlan ? (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="font-semibold text-gray-950">{String(firstPlan.name)}</div>
                            <div className="mt-1 text-xs text-gray-500">Status: {String(firstPlan.status || 'draft')} | Version: {String(firstPlan.version || 1)}</div>
                          </div>
                          <button type="button" onClick={onContinueToCopyUrl} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Continue to copy and URL</button>
                        </div>
                        <PlanSummary plan={firstPlan} />
                      </div>
                      <RowList rows={(overview?.draftPlans || []).slice(1)} empty="No older plans." fields={['name', 'status', 'version', 'created_at']} />
                    </div>
                  ) : (
                    <EmptyState text="No ad set plan yet. Go to Create ads and create a package from a selected campaign, products, content source and personas." />
                  )}
                </Panel>

<Panel title="Approve plan">
                  <p className="text-sm text-gray-600">Approve only after the plan, creatives, selected copy and destination URL are correct. The Run ads tab uses this exact approved version.</p>
                  {firstPlan ? (
                    <div className="rounded-lg border border-gray-200 p-4">
                      <div className="font-semibold text-gray-950">{String(firstPlan.name)}</div>
                      <div className="text-xs text-gray-500 mt-1">Status: {String(firstPlan.status)} | Version: {String(firstPlan.version || 1)} | Creatives: {planCreatives.length}</div>
                      <PlanSummary plan={firstPlan} />
                      {planApprovalBlocked && (
                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                          Finish Copy and URL first: {copyDestinationBlockers.join(' ')}
                        </div>
                      )}
                      <button
                        disabled={Boolean(busy) || firstPlan.status === 'approved' || planApprovalBlocked}
                        onClick={onApprovePlan}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-50 mt-3"
                      >
                        Approve plan
                      </button>
                      {planCreatives.length > 0 && (
                        <button
                          disabled={Boolean(busy)}
                          onClick={onApprovePlanCreatives}
                          className="ml-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 mt-3"
                        >
                          Approve plan creatives
                        </button>
                      )}
                    </div>
                  ) : <EmptyState text="No plan is ready for approval. Create ads first, then review copy and destination URL." />}
                </Panel>

<Panel title="Run approved ads">
                  <Gate gate={overview?.publishGate} />
                  <button
                    disabled={Boolean(busy) || !firstPlan || !overview?.publishGate?.allowed}
                    onClick={onRunApprovedAds}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-50 mt-4"
                  >
                    Create paused Meta ads
                  </button>
                  {!firstPlan && <p className="text-sm text-amber-700 mt-3">Create and approve a plan before running ads.</p>}
                </Panel>

<div className="space-y-4">
                  <Panel title="Publish status">
                    <PublishJobTracker
                      jobs={overview?.latestPublishJobs}
                      onRetry={onRetryPublish}
                      retryBusyId={retryBusyId}
                    />
                  </Panel>
                  <Panel title="Logic Ads activity">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.entries(overview?.counts || {}).map(([key, value]) => (
                        <div key={key} className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                          <div className="text-xs text-gray-500">{countLabels[key] || key}</div>
                          <div className="text-lg font-bold text-gray-950 mt-1">{value}</div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                  <Panel title="Recommendations">
                    <RecommendationList rows={overview?.openRecommendations || []} />
                  </Panel>
                </div>
    </>
  );
}
