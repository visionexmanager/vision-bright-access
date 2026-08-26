/**
 * Consent, retention and reach for one cloned voice.
 *
 * Added to the existing Voice Studio rather than replacing any of it. The
 * studio already handles naming, samples and training; this is the part that
 * was missing — the record of who agreed to a copy of a real person's voice
 * being made, and the controls to withdraw it.
 *
 * The three things it shows, in the order they matter:
 *
 *   1. Whether the voice can be used at all, in one word.
 *   2. The consent record: who, when, and the exact wording they agreed to.
 *   3. When the recordings stop being kept, and whether they are already gone.
 *
 * Every control here is disabled by state rather than hidden by it. A button
 * that vanishes is a button a screen-reader user cannot find to ask why; a
 * disabled button with a reason beside it can be read.
 */

import { useState } from "react";
import { AlertTriangle, Check, ShieldCheck, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CONSENT_STATEMENT_V1 } from "@/services/ai-media-studio/voiceStudioService";
import type { VoiceLifecycleState, VoiceProfile } from "@/lib/types/voice-studio";

/** What each state means, in the words a person would use. */
const STATE_LABEL: Record<VoiceLifecycleState, string> = {
  pending_consent: "Waiting for consent",
  ready: "Ready",
  revoked: "Consent withdrawn",
  deleting: "Deleting",
  deleted: "Deleted",
  error: "Needs attention",
};

const STATE_VARIANT: Record<VoiceLifecycleState, "default" | "secondary" | "destructive" | "outline"> = {
  pending_consent: "outline",
  ready: "default",
  revoked: "secondary",
  deleting: "secondary",
  deleted: "secondary",
  error: "destructive",
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
}

interface VoiceConsentPanelProps {
  profile: VoiceProfile;
  onGrant: (input: { id: string; subject: string }) => void;
  onRevoke: (id: string) => void;
  onWhatsAppChange: (input: { id: string; enabled: boolean }) => void;
  isRevoking?: boolean;
}

export function VoiceConsentPanel({
  profile, onGrant, onRevoke, onWhatsAppChange, isRevoking,
}: VoiceConsentPanelProps) {
  const [subject, setSubject] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const state = profile.voice_state ?? "pending_consent";
  const granted = profile.consent_status === "granted";
  const grantedOn = formatDate(profile.consent_granted_at);
  const retainUntil = formatDate(profile.samples_retain_until);
  const samplesGone = formatDate(profile.samples_deleted_at);

  return (
    <section className="space-y-4 rounded-lg border p-4" aria-labelledby={`consent-${profile.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`consent-${profile.id}`} className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Consent and retention
        </h3>
        {/* The state is a word, not only a colour. */}
        <Badge variant={STATE_VARIANT[state]}>{STATE_LABEL[state]}</Badge>
      </div>

      {profile.provider_delete_error && (
        // Left visible on purpose: this means a copy of the voice may still
        // exist at the provider, and quietly retrying would hide that.
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>This voice was not fully removed: {profile.provider_delete_error}. Try deleting it again.</span>
        </p>
      )}

      {granted ? (
        <div className="space-y-3 text-sm">
          <p className="flex items-center gap-2 text-muted-foreground">
            <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              Consent recorded{profile.consent_subject ? ` for ${profile.consent_subject}` : ""}
              {grantedOn ? ` on ${grantedOn}` : ""}.
            </span>
          </p>

          {profile.consent_statement && (
            <details className="rounded border bg-muted/30 p-3">
              <summary className="cursor-pointer font-medium">What was agreed to</summary>
              <p className="mt-2 text-muted-foreground">{profile.consent_statement}</p>
            </details>
          )}

          <p className="text-muted-foreground">
            {samplesGone
              ? `The uploaded recordings were deleted on ${samplesGone}.`
              : retainUntil
                ? `The uploaded recordings are kept until ${retainUntil}, then deleted automatically.`
                : "The uploaded recordings are deleted once this voice has been created."}
          </p>

          <div className="flex items-center justify-between gap-4 rounded border p-3">
            <div>
              <Label htmlFor={`wa-${profile.id}`} className="font-medium">Offer on WhatsApp</Label>
              <p className="text-xs text-muted-foreground">
                {state === "ready"
                  ? "Lets you pick this voice for WhatsApp replies from Voice settings."
                  : "Available once this voice is ready."}
              </p>
            </div>
            <Switch
              id={`wa-${profile.id}`}
              checked={profile.whatsapp_enabled}
              disabled={state !== "ready"}
              onCheckedChange={(enabled) => onWhatsAppChange({ id: profile.id, enabled })}
            />
          </div>

          <Button
            variant="outline"
            className="w-full text-destructive"
            disabled={isRevoking}
            onClick={() => setConfirmRevoke(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Withdraw consent and delete this voice
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This voice cannot be created until consent is recorded.
          </p>

          <div className="space-y-1">
            <Label htmlFor={`subject-${profile.id}`}>Whose voice is this?</Label>
            <Input
              id={`subject-${profile.id}`}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Full name of the person speaking"
              autoComplete="off"
            />
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
            />
            <span className="text-muted-foreground">{CONSENT_STATEMENT_V1}</span>
          </label>

          <Button
            className="w-full"
            disabled={!agreed || subject.trim().length === 0}
            onClick={() => onGrant({ id: profile.id, subject })}
          >
            Record consent
          </Button>
        </div>
      )}

      {confirmRevoke && (
        <AlertDialog open onOpenChange={(open) => { if (!open) setConfirmRevoke(false); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Withdraw consent for "{profile.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This stops the voice being used immediately, deletes the copy held by the
                voice provider, and deletes the uploaded recordings. If any part of that
                fails you will be told, and nothing will be reported as deleted until it is.
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => { onRevoke(profile.id); setConfirmRevoke(false); }}
              >
                Withdraw and delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </section>
  );
}
