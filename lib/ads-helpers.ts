import { NextRequest } from 'next/server';

/**
 * Map days parameter to Meta date_preset or time_range.
 * Returns the query string fragment to append.
 */
export function getDateParam(request: NextRequest): string {
  const days = parseInt(request.nextUrl.searchParams.get('days') || '7');
  const presetMap: Record<number, string> = {
    1: 'today',
    7: 'last_7d',
    14: 'last_14d',
    30: 'last_30d',
    90: 'last_90d',
  };
  return presetMap[days] || 'last_7d';
}

export function getDatePresetInline(request: NextRequest): string {
  const preset = getDateParam(request);
  return `date_preset(${preset})`;
}
