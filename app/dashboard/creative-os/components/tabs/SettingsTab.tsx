"use client";

import { Loader2, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CardContent } from "@/components/ui/card";
import { CreativeOsCard } from "../../_components/CreativeOsCard";
import { WorkflowButton } from "../../_components/MagicButton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input, GridList } from "../../_components/FormFields";
import { formatDate } from "../../lib/dates";
import type { ProductRole } from "../../types";
import { SectionTitle } from "../shared/SectionTitle";
import { AccessPersonCard, MiniFlow } from "../shared/WorkspaceWidgets";
import type { SettingsTabProps } from "./types";

export function SettingsTab(props: SettingsTabProps) {
  const {
    sectionRefs,
    editorDraft,
    setEditorDraft,
    editorError,
    setEditorError,
    editorInviteStatus,
    inviteEditor,
    acceptedPermissions,
    pendingPermissions,
    accessPermissionHistory,
    deletingInviteHistoryIds,
    removeEditor,
    resendInvite,
    inviteAgain,
    deleteInviteHistory,
  } = props;
  return (
    <>
      <div
        ref={(el) => {
          sectionRefs.current.access = el;
        }}
        className="space-y-4"
      >
        <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <CreativeOsCard>
            <CardContent className="p-4">
              <SectionTitle
                title="Invite editor or reviewer"
                subtitle="Invite people to your Creative OS team. They only receive work after accepting and getting assigned briefs."
              />
              <div className="mt-4 grid gap-3">
                <Input
                  label="Editor email"
                  value={editorDraft.userName}
                  onChange={(event) => {
                    setEditorDraft((current) => ({
                      ...current,
                      userName: event.target.value,
                    }));
                    setEditorError("");
                  }}
                  placeholder="editor@brand.com"
                />
                <div className="space-y-2">
                  <Label className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                    Role
                  </Label>
                  <Select
                    value={editorDraft.role}
                    onValueChange={(value) =>
                      setEditorDraft((current) => ({
                        ...current,
                        role: value as ProductRole,
                      }))
                    }
                  >
                    <SelectTrigger className="min-h-12 w-full rounded-xl">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="editor">
                        Editor - can receive creative tasks
                      </SelectItem>
                      <SelectItem value="reviewer">
                        Reviewer - can approve or request changes
                      </SelectItem>
                      <SelectItem value="viewer">
                        Viewer - can follow progress
                      </SelectItem>
                      <SelectItem value="admin">
                        Admin - can manage team access and work
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editorError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{editorError}</AlertDescription>
                  </Alert>
                ) : null}
                <WorkflowButton
                  type="button"
                  className="h-10 w-full rounded-xl sm:w-auto"
                  onClick={inviteEditor}
                  disabled={editorInviteStatus === "sending"}
                >
                  {editorInviteStatus === "sending" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Users size={16} />
                  )}
                  {editorInviteStatus === "sending"
                    ? "Sending invite..."
                    : "Send invite"}
                </WorkflowButton>
                {editorInviteStatus === "sent" ? (
                  <Alert className="border-green-200 bg-green-50 text-green-700 [&>svg]:text-green-700">
                    <AlertDescription>Invite sent.</AlertDescription>
                  </Alert>
                ) : null}
              </div>
            </CardContent>
          </CreativeOsCard>
          <CreativeOsCard>
            <CardContent className="p-4">
              <SectionTitle
                title="Access rules"
                subtitle="An invite is not work access yet. Assign briefs after the person accepts."
              />
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <MiniFlow
                  title="Editors"
                  body="Receive tasks and upload delivered creatives."
                />
                <MiniFlow
                  title="Reviewers"
                  body="Approve, delete or request changes before launch."
                />
                <MiniFlow
                  title="Viewers"
                  body="Can follow the production status without changing work."
                />
                <MiniFlow
                  title="Admins"
                  body="Manage products, sources, tasks and team members."
                />
              </div>
            </CardContent>
          </CreativeOsCard>
        </div>
        <GridList
          title="Active access"
          subtitle="Accepted team members. Assign briefs to give them work."
          emptyText="No active editors yet."
          items={acceptedPermissions.map((permission) => (
            <AccessPersonCard
              key={permission.id}
              permission={permission}
              statusLabel="Active"
              statusTone="green"
              detail={[
                permission.respondedAt
                  ? `accepted ${formatDate(permission.respondedAt)}`
                  : "",
              ]
                .filter(Boolean)
                .join(" - ")}
              actions={[
                {
                  label: "Remove access",
                  onClick: () => removeEditor(permission.id),
                  tone: "danger",
                },
              ]}
            />
          ))}
        />
        <GridList
          title="Pending invites"
          subtitle="Pending team invites. They cannot work until they accept."
          emptyText="No pending invites."
          items={pendingPermissions.map((permission) => (
            <AccessPersonCard
              key={permission.id}
              permission={permission}
              statusLabel="Invited"
              statusTone="blue"
              detail={[
                permission.inviteSentAt || permission.invitedAt
                  ? `sent ${formatDate(permission.inviteSentAt || permission.invitedAt || "")}`
                  : "",
                permission.lastEmailError ? "email failed" : "",
              ]
                .filter(Boolean)
                .join(" - ")}
              actions={[
                {
                  label: "Resend",
                  onClick: () => resendInvite(permission.id),
                  tone: "primary",
                },
                {
                  label: "Revoke",
                  onClick: () => removeEditor(permission.id),
                  tone: "warning",
                },
              ]}
            />
          ))}
        />
        <GridList
          title="Invite history"
          subtitle="Declined, revoked and expired team invites."
          emptyText="No invite history yet."
          items={accessPermissionHistory.map((permission) => (
            <AccessPersonCard
              key={`${permission.id}-${permission.status}`}
              permission={permission}
              statusLabel={permission.status}
              statusTone="slate"
              detail={[
                permission.respondedAt
                  ? formatDate(permission.respondedAt)
                  : permission.revokedAt
                    ? formatDate(permission.revokedAt)
                    : "",
              ]
                .filter(Boolean)
                .join(" - ")}
              actions={[
                {
                  label: "Invite again",
                  onClick: () => inviteAgain(permission),
                  tone: "primary",
                },
                {
                  label: deletingInviteHistoryIds.includes(permission.id)
                    ? "Deleting"
                    : "Delete",
                  onClick: () => deleteInviteHistory(permission.id),
                  tone: "danger",
                  icon: "trash",
                  iconOnly: true,
                  disabled: deletingInviteHistoryIds.includes(
                    permission.id,
                  ),
                  ariaLabel: `Delete invite history for ${permission.email || permission.userName}`,
                },
              ]}
            />
          ))}
        />
      </div>
    </>
  );
}
