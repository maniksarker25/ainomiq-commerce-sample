import React from 'react';
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, RefreshCw, Loader2 } from 'lucide-react';
import { DbRow } from '../types';
import { parseDbJson } from '../utils';
import { EmptyState, MetricCard } from './CoreUI';

export function PlanSummary({ plan }: { plan: DbRow }) {
  const parsed = parseDbJson(plan.plan_json) || {};
  const adsets = Array.isArray(parsed?.adsets) ? parsed.adsets : [];
  const adCount = adsets.reduce((total: number, adset: any) => total + (Array.isArray(adset?.ads) ? adset.ads.length : 0), 0);
  const campaign = parsed?.campaign || {};
  const campaignName = String(campaign?.name || campaign?.id || 'Campaign selected in Create ads');
  const contentSource = String(parsed?.content_source || 'Selected content');
  const targetingSource = String(parsed?.targeting_source || 'Selected targeting');
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-4">
      <MetricCard label="Campaign" value={campaignName} />
      <MetricCard label="Ad sets" value={adsets.length} />
      <MetricCard label="Ads" value={adCount} />
      <MetricCard label="Source" value={contentSource.replace(/_/g, ' ')} />
      <div className="rounded-lg border border-gray-200 bg-white p-3 md:col-span-4">
        <div className="text-xs text-gray-500">Targeting</div>
        <div className="mt-1 text-sm font-semibold text-gray-950">{targetingSource.replace(/_/g, ' ')}</div>
      </div>
    </div>
  );
}

export function formatLocalDateTime(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  const isoLike = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw) ? `${raw.replace(' ', 'T')}Z` : raw;
  const date = new Date(isoLike);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

export function formatFieldValue(field: string, value: unknown) {
  if (field === 'created_at' || field === 'updated_at') return formatLocalDateTime(value);
  return String(value ?? '-');
}

export function BatchList({ rows, empty, selectedBatchId, onReview }: { rows: DbRow[]; empty: string; selectedBatchId: string; onReview: (row: DbRow) => void }) {
  if (!rows.length) return <EmptyState text={empty} />;
  return (
    <div className="divide-y divide-gray-100">
      {rows.map(row => {
        const id = String(row.id || '');
        const isSelected = Boolean(id && id === selectedBatchId);
        return (
          <div key={id || String(row.name)} className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="font-semibold text-sm text-gray-900">{String(row.name || row.id)}</div>
              <div className="text-xs text-gray-500 mt-1">status: {formatFieldValue('status', row.status)} | created: {formatLocalDateTime(row.created_at)}</div>
            </div>
            <button
              type="button"
              onClick={() => onReview(row)}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${isSelected ? 'bg-blue-50 text-blue-700' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              Review ads
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function RowList({ rows, empty, fields }: { rows: DbRow[]; empty: string; fields: string[] }) {
  if (!rows.length) return <EmptyState text={empty} />;
  return (
    <div className="divide-y divide-gray-100">
      {rows.map(row => (
        <div key={String(row.id)} className="py-3">
          <div className="font-semibold text-sm text-gray-900">{String(row[fields[0]] || row.id)}</div>
          <div className="text-xs text-gray-500 mt-1">{fields.slice(1).map(field => `${field}: ${formatFieldValue(field, row[field])}`).join(' | ')}</div>
        </div>
      ))}
    </div>
  );
}

export function recommendationLabel(value: unknown) {
  const raw = String(value || '').replace(/_/g, ' ').trim();
  if (!raw) return 'Recommended action';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function RecommendationList({ rows }: { rows: DbRow[] }) {
  if (!rows.length) return <EmptyState text="No recommendations yet. Once Meta performance data is available, Logic Ads will show what to improve next." />;
  return (
    <div className="divide-y divide-gray-100">
      {rows.map(row => (
        <div key={String(row.id || row.title)} className="py-3">
          <div className="font-semibold text-sm text-gray-900">{String(row.title || 'Recommendation')}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">{recommendationLabel(row.recommendation_type)}</span>
            {row.severity && <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">{recommendationLabel(row.severity)}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SplitLists(props: { leftTitle: string; leftRows: DbRow[]; leftEmpty: string; rightTitle: string; rightRows: DbRow[]; rightEmpty: string }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>
        <h4 className="font-semibold text-gray-950 mb-2">{props.leftTitle}</h4>
        {props.leftRows.length ? (
          <div className="space-y-2">
            {props.leftRows.map(row => (
              <div key={String(row.id || row.headline)} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                <div className="font-semibold text-gray-950">{String(row.headline || 'Selected copy')}</div>
                <div className="mt-1 text-xs font-semibold text-blue-700">{row.selected ? 'Selected for the plan' : 'Ready for review'}</div>
              </div>
            ))}
          </div>
        ) : <EmptyState text={props.leftEmpty} />}
      </div>
      <div>
        <h4 className="font-semibold text-gray-950 mb-2">{props.rightTitle}</h4>
        {props.rightRows.length ? (
          <div className="space-y-2">
            {props.rightRows.map(row => (
              <div key={String(row.id || row.base_url)} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                <div className="break-all font-semibold text-gray-950">{String(row.base_url || 'Destination URL')}</div>
                <div className={`mt-1 text-xs font-semibold ${row.valid ? 'text-blue-700' : 'text-amber-700'}`}>{row.valid ? 'Valid destination' : 'Needs a valid destination'}</div>
              </div>
            ))}
          </div>
        ) : <EmptyState text={props.rightEmpty} />}
      </div>
    </div>
  );
}

export function PublishJobTracker({
  jobs,
  onRetry,
  retryBusyId,
}: {
  jobs?: any[];
  onRetry: (jobId: string) => void;
  retryBusyId?: string | null;
}) {
  const [expandedJobId, setExpandedJobId] = React.useState<string | null>(null);

  if (!jobs || jobs.length === 0) {
    return <EmptyState text="No recent publish activity. Run approved plans to push ads to Meta." />;
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => {
        const jobId = String(job.id);
        const isExpanded = expandedJobId === jobId;
        const items = Array.isArray(job.items) ? job.items : [];
        const completedCount = items.filter((item: any) => item.status === 'completed').length;
        const failedCount = items.filter((item: any) => item.status === 'failed').length;
        const totalCount = items.length;
        const isPartial = job.status === 'partial' || (completedCount > 0 && failedCount > 0);
        const hasFailed = failedCount > 0 || job.status === 'failed' || isPartial;
        const isPublishing = job.status === 'publishing' || job.status === 'ready' || items.some((item: any) => item.status === 'publishing' || item.status === 'queued');
        const isRetrying = retryBusyId === jobId;

        const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        return (
          <div key={jobId} className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden transition-all duration-200">
            {/* Header row */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-gray-50/50 cursor-pointer" onClick={() => setExpandedJobId(isExpanded ? null : jobId)}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm text-gray-900">
                    Publish Job {jobId.slice(0, 8)}...
                  </span>
                  {isPublishing && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Publishing ({progressPct}%)
                    </span>
                  )}
                  {job.status === 'completed' && !hasFailed && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Completed
                    </span>
                  )}
                  {isPartial && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Partial ({completedCount}/{totalCount} in Meta)
                    </span>
                  )}
                  {hasFailed && !isPartial && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Failed ({failedCount} errors)
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Plan ID: {String(job.plan_id).slice(0, 8)}... | Requested: {formatLocalDateTime(job.created_at)}
                </div>
                {job.error && (
                  <div className="text-xs text-red-600 mt-1.5 font-medium border-l-2 border-red-500 pl-2">
                    {job.error}
                  </div>
                )}
              </div>

              {/* Action and expand button */}
              <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                {hasFailed && (
                  <button
                    type="button"
                    disabled={isRetrying || isPublishing}
                    onClick={() => onRetry(jobId)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    {isRetrying ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Retry failed ads
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setExpandedJobId(isExpanded ? null : jobId)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-100 h-1">
              <div
                className={`h-1 transition-all duration-500 ${isPartial ? 'bg-amber-500' : hasFailed ? 'bg-red-500' : 'bg-blue-600'}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Item list details (expanded) */}
            {isExpanded && (
              <div className="border-t border-gray-100 bg-gray-50/50 p-4 space-y-2">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Campaign Publish Details ({completedCount}/{totalCount} completed)
                </div>
                {items.length === 0 ? (
                  <div className="text-xs text-gray-400 italic">No items queued in this job.</div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {items.map((item: any) => {
                      const isItemFailed = item.status === 'failed';
                      const isItemCompleted = item.status === 'completed';
                      return (
                        <div key={item.id} className="bg-white border border-gray-150 rounded-lg p-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-2 shadow-xs">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-gray-900">
                              Adset Group: <span className="font-mono text-gray-600">{item.adset_key}</span>
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              Creative: {String(item.creative_id).slice(0, 8)}...
                              {item.meta_ad_id && ` | Meta Ad ID: ${item.meta_ad_id}`}
                            </div>
                            {item.error && (
                              <div className="text-[11px] text-red-600 mt-1 font-medium bg-red-50/50 rounded px-1.5 py-0.5 border border-red-100">
                                {item.error}
                              </div>
                            )}
                          </div>
                          <div className="shrink-0 flex items-center md:justify-end">
                            {isItemCompleted && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                                <CheckCircle2 className="h-3 w-3" />
                                Published
                              </span>
                            )}
                            {isItemFailed && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                                <AlertTriangle className="h-3 w-3" />
                                Failed
                              </span>
                            )}
                            {item.status === 'publishing' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Publishing
                              </span>
                            )}
                            {item.status === 'queued' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                                Queued
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
