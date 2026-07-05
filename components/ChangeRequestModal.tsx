'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { getSession } from '../lib/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ChangeRequestModalProps {
  section: string;
  fields: Array<{ label: string; placeholder: string; key: string; type?: 'text' | 'textarea' }>;
  onClose: () => void;
}

export default function ChangeRequestModal({ section, fields, onClose }: ChangeRequestModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const tenantId = getSession()?.email || '';
    if (!tenantId) return;

    const changeText = fields
      .map(f => `${f.label}: ${values[f.key] || '(no change)'}`)
      .join('\n');

    setSending(true);
    setError(null);

    try {
      const res = await fetch('/api/cs/change-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          section,
          changes: changeText,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSent(true);
      }
    } catch {
      setError('Failed to send request');
    } finally {
      setSending(false);
    }
  };

  const canSubmit = !sending && fields.some(f => values[f.key]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md" showCloseButton={!sent}>
        {sent ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto mb-4 size-12 text-green-600" />
            <DialogHeader className="items-center text-center">
              <DialogTitle>Request submitted</DialogTitle>
              <DialogDescription>
                Your change request has been sent to the Ainomiq team. We will review and apply the changes.
              </DialogDescription>
            </DialogHeader>
            <Button className="mt-6" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Request changes: {section}</DialogTitle>
              <DialogDescription>
                Describe your desired changes below. The Ainomiq team will review and apply them.
              </DialogDescription>
            </DialogHeader>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-col gap-4">
              {fields.map(field => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  {field.type === 'textarea' ? (
                    <Textarea
                      id={field.key}
                      placeholder={field.placeholder}
                      value={values[field.key] || ''}
                      onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                      rows={3}
                    />
                  ) : (
                    <Input
                      id={field.key}
                      type="text"
                      placeholder={field.placeholder}
                      value={values[field.key] || ''}
                      onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                {sending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send request'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
