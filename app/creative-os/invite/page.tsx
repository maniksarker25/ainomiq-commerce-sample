import Link from "next/link";
import { getInviteByToken, isExpiredInvite, markInviteExpired } from "@/lib/creative-os-invites";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type InvitePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function actionHref(token: string, response: "accepted" | "rejected") {
  const params = new URLSearchParams({ token, response });
  if (response === "rejected") params.set("confirm", "1");
  return `/api/ad-manager/creative-os/invites/respond?${params.toString()}`;
}

export default async function CreativeOsInvitePage({
  searchParams,
}: InvitePageProps) {
  const params = searchParams ? await searchParams : {};
  const token = firstValue(params.token);
  const rawInvite = token
    ? await getInviteByToken(token).catch(() => null)
    : null;
  const invite =
    rawInvite && isExpiredInvite(rawInvite)
      ? await markInviteExpired(rawInvite).catch(() => rawInvite)
      : rawInvite;
  const unavailable =
    !invite || invite.status === "expired" || invite.status === "revoked";

  const title = !invite
    ? "Invite link not found"
    : invite.status === "expired"
      ? "Invite expired"
      : invite.status === "revoked"
        ? "Invite revoked"
        : invite.status === "accepted"
          ? "Invite already accepted"
          : invite.status === "rejected"
            ? "Invite declined"
            : "You have been invited to Creative OS";

  const body = !invite
    ? "Ask the workspace owner to send a fresh Creative OS invite."
    : invite.status === "invited"
      ? `${invite.invitedByName || invite.createdBy || "Ainomiq"} invited ${invite.email} to collaborate in a Creative OS workspace.`
      : invite.status === "accepted"
        ? `${invite.email} already accepted this invite. Sign in with that email to open Creative OS.`
        : invite.status === "rejected"
          ? `${invite.email} declined this invite. Ask the workspace owner to invite you again if this was a mistake.`
          : invite.status === "revoked"
            ? "The workspace owner revoked this invite."
            : "This invite has expired. Ask the workspace owner for a new invite.";

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8">
      <Card className="mx-auto max-w-xl shadow-sm">
        <CardHeader className="space-y-3">
          <Badge
            variant={unavailable ? "destructive" : "secondary"}
            className="w-fit uppercase tracking-wide"
          >
            Ainomiq Creative OS
          </Badge>
          <CardTitle>{title}</CardTitle>
          <Alert variant={unavailable ? "destructive" : "default"}>
            <AlertDescription>{body}</AlertDescription>
          </Alert>
        </CardHeader>
        <CardFooter className="flex flex-wrap gap-3">
          {invite?.status === "invited" ? (
            <>
              <Button asChild>
                <Link href={actionHref(invite.token, "accepted")}>
                  Accept invite
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={actionHref(invite.token, "rejected")}>Decline</Link>
              </Button>
            </>
          ) : invite?.status === "accepted" ? (
            <>
              <Button asChild>
                <Link
                  href={`/login?return=${encodeURIComponent("/dashboard/creative-os")}&force=1&email=${encodeURIComponent(invite.email)}&invite=${encodeURIComponent(invite.token)}`}
                >
                  Sign in
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link
                  href={`/register?return=${encodeURIComponent("/dashboard/creative-os")}&force=1&email=${encodeURIComponent(invite.email)}&invite=${encodeURIComponent(invite.token)}`}
                >
                  Create account
                </Link>
              </Button>
            </>
          ) : (
            <Button asChild variant="outline">
              <Link href="/">Back to Ainomiq</Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}
