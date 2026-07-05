'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Clock,
  Loader2,
  Phone,
} from 'lucide-react';
import VoipTest from '../../../../components/VoipTest';
import { CallItem, TranscriptLine, Stats } from '../types';
import { timeAgo } from '../utils';
import { StatCard } from '../_components/StatCard';
import { InboxRow } from '../_components/InboxRow';
import { MessageBubble } from '../_components/MessageBubble';
import { EmptyState } from '../_components/EmptyState';
import { SectionHeader } from '../_components/SectionHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface CallsTabProps {
  tenantId: string | null;
  twilioStatus: { connected: boolean; number?: string; status?: string };
  timeframe: number;
  stats: Stats | null;
  loading: boolean;
  calls: CallItem[];
  callsLoading: boolean;
  selectedCall: CallItem | null;
  setSelectedCall: (call: CallItem | null) => void;
  callTranscript: TranscriptLine[];
  callTranscriptLoading: boolean;
  fetchCallTranscript: (callSid: string) => Promise<void>;
}

export default function CallsTab({
  tenantId,
  twilioStatus,
  timeframe,
  stats,
  loading,
  calls,
  callsLoading,
  selectedCall,
  setSelectedCall,
  callTranscript,
  callTranscriptLoading,
  fetchCallTranscript,
}: CallsTabProps) {
  const router = useRouter();
  const [showVoipTest, setShowVoipTest] = useState(false);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  const handleSelectCall = (call: CallItem) => {
    setSelectedCall(call);
    setMobileShowDetail(true);
    void fetchCallTranscript(call.callSid);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-muted/20">
        <button
          type="button"
          onClick={() => setShowVoipTest((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
        >
          Test your line
          {showVoipTest ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </button>
        {showVoipTest ? (
          <div className="border-t border-border/60 px-4 pb-4 pt-2">
            <VoipTest
              tenantId={tenantId || ''}
              twilioConnected={twilioStatus.connected}
              twilioNumber={twilioStatus.number}
            />
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <SectionHeader
            title="Calls"
            description="Click any call to open the transcript of what was discussed."
            className="mb-0"
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="Calls (selected period)"
              value={loading ? '-' : (stats?.calls ?? 0)}
              loading={loading}
              icon={Phone}
              iconClassName="text-primary"
            />
            <StatCard
              label="Expected calls/month"
              value={
                loading
                  ? '-'
                  : Math.max(
                      0,
                      Math.round(
                        ((stats?.calls ?? 0) / Math.max(timeframe || 7, 1)) * 30,
                      ),
                    )
              }
              loading={loading}
              icon={Clock}
              iconClassName="text-primary"
            />
            <Card size="sm" className="gap-2">
              <CardHeader className="pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Phone connection
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {twilioStatus.connected ? (
                  <>
                    <div className="text-sm font-semibold text-green-700">
                      Connected via Twilio
                      {twilioStatus.number ? ` (${twilioStatus.number})` : ''}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Voice webhook active
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-semibold text-yellow-700">
                      Not connected
                    </div>
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={() =>
                        router.push('/dashboard/automations/cs-onboarding')
                      }
                    >
                      Connect number
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <Card
              className={cn(
                'overflow-hidden py-0 lg:col-span-2',
                mobileShowDetail && selectedCall && 'hidden lg:flex lg:flex-col',
              )}
            >
              <CardHeader className="border-b py-3">
                <CardTitle className="text-sm">Recent calls</CardTitle>
              </CardHeader>
              <ScrollArea className="h-[500px]">
                {callsLoading ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : calls.length === 0 ? (
                  <EmptyState message="No calls yet" />
                ) : (
                  calls.map((call) => (
                    <InboxRow
                      key={call.callSid}
                      selected={selectedCall?.callSid === call.callSid}
                      onClick={() => handleSelectCall(call)}
                      title={call.from || 'Unknown caller'}
                      subtitle={`${Math.max(0, call.durationSec || 0)}s duration`}
                      meta={timeAgo(call.createdAt)}
                      badges={
                        <Badge variant="outline" className="capitalize text-[10px]">
                          {call.status || 'unknown'}
                        </Badge>
                      }
                    />
                  ))
                )}
              </ScrollArea>
            </Card>

            <Card
              className={cn(
                'min-h-[220px] lg:col-span-3',
                !mobileShowDetail && !selectedCall && 'hidden lg:block',
                mobileShowDetail || selectedCall ? 'flex flex-col' : 'hidden lg:flex lg:flex-col',
              )}
            >
              <CardHeader className="border-b pb-3 lg:border-b-0">
                <div className="flex items-center gap-2">
                  {mobileShowDetail && selectedCall ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="lg:hidden"
                      onClick={() => setMobileShowDetail(false)}
                      aria-label="Back to call list"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                  ) : null}
                  <CardTitle className="text-sm">
                    {selectedCall
                      ? `Transcript • ${selectedCall.from || 'Unknown caller'}`
                      : 'Transcript'}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col">
                {!selectedCall ? (
                  <EmptyState message="Select a call on the left to view transcript." />
                ) : callTranscriptLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading transcript...
                  </div>
                ) : callTranscript.length === 0 ? (
                  <EmptyState
                    message="No transcript saved yet for this call."
                    actionLabel={
                      !twilioStatus.connected ? 'Connect phone' : undefined
                    }
                    onAction={
                      !twilioStatus.connected
                        ? () => router.push('/dashboard/automations/cs-onboarding')
                        : undefined
                    }
                  />
                ) : (
                  <ScrollArea className="h-[460px]">
                    <div className="flex flex-col gap-3 pr-4">
                      {callTranscript.map((line, idx) => (
                        <MessageBubble
                          key={`${line.createdAt}-${idx}`}
                          speaker={line.speaker}
                          variant={line.speaker === 'agent' ? 'agent' : 'customer'}
                          align={line.speaker === 'agent' ? 'start' : 'end'}
                        >
                          {line.message}
                        </MessageBubble>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
