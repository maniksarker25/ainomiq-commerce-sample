"use client";

import { CardContent } from "@/components/ui/card";
import { CreativeOsCard } from "../../_components/CreativeOsCard";
import { SectionTitle } from "../shared/SectionTitle";
import { MiniFlow } from "../shared/WorkspaceWidgets";

export function EditorInfoPanel() {
  return (
    <div className="space-y-4">
      <SectionTitle
        title="How Creative OS works"
        subtitle="A simple workflow for opening briefs, using the Library and sending finished ads back for review."
      />
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <CreativeOsCard>
          <CardContent className="p-4">
            <div className="text-sm font-bold uppercase tracking-wide text-primary">
              Editor workflow
            </div>
            <div className="mt-3 grid gap-3">
              <MiniFlow
                title="1. Open My ad tasks"
                body="This is your work queue. You only see briefs assigned to your editor email."
              />
              <MiniFlow
                title="2. Read the brief"
                body="The brief contains the product context, buying angle, hooks, format, output count, due date and extra instructions from the owner."
              />
              <MiniFlow
                title="3. Open Library"
                body="Use the button on the brief or the Library tab to open the assigned Ainomiq Library source set."
              />
              <MiniFlow
                title="4. Create the ad"
                body="Make the finished edit outside Creative OS using the Library files and the brief direction."
              />
              <MiniFlow
                title="5. Submit for review"
                body="Upload the finished video or image to Ainomiq and choose the Library file you used for the edit."
              />
            </div>
          </CardContent>
        </CreativeOsCard>
        <div className="space-y-4">
          <CreativeOsCard>
            <CardContent className="p-4">
              <div className="text-sm font-bold uppercase tracking-wide text-primary">
                Which file goes where?
              </div>
              <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
                <div>
                  <div className="font-semibold text-foreground">
                    Finished ad file
                  </div>
                  <div>
                    Upload the final video or image you made. Creative OS stores
                    it in Ainomiq for review.
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-foreground">
                    Library file used
                  </div>
                  <div>
                    Choose the exact Library file you used for the edit.
                  </div>
                </div>
              </div>
            </CardContent>
          </CreativeOsCard>
          <CreativeOsCard>
            <CardContent className="p-4">
              <div className="text-sm font-bold uppercase tracking-wide text-primary">
                Status meanings
              </div>
              <div className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
                <div>
                  <strong className="text-foreground">Assigned:</strong> the
                  brief is ready to work on.
                </div>
                <div>
                  <strong className="text-foreground">Delivered:</strong> your
                  work was submitted for review.
                </div>
                <div>
                  <strong className="text-foreground">
                    Revision requested:
                  </strong>{" "}
                  the owner wants changes.
                </div>
                <div>
                  <strong className="text-foreground">Approved:</strong> the
                  owner accepted the submitted ad.
                </div>
              </div>
            </CardContent>
          </CreativeOsCard>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <MiniFlow
          title="Library"
          body="Open the assigned Ainomiq Library source set from the brief, then choose the exact Library file when you submit the finished edit."
        />
        <MiniFlow
          title="Submitted work"
          body="After submitting, your delivery appears in Submitted work with its review status. The owner receives a notification to review it."
        />
        <MiniFlow
          title="Access rules"
          body="Editor accounts can view assigned briefs and Library folders, but cannot manage products, invites, launch settings or delete workspace files."
        />
        <MiniFlow
          title="When something is blocked"
          body="If a Library file will not open, tell the workspace owner. They can restore or re-import it in the Library."
        />
      </div>
    </div>
  );
}
