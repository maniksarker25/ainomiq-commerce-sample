import fs from "fs";

const path = "app/dashboard/creative-os/components/CreativeOsWorkspace.tsx";
let content = fs.readFileSync(path, "utf8");
const lines = content.split(/\r?\n/);

const importBlock = `import { ChatPanel, CardList, MiniFlow } from "./shared/WorkspaceWidgets";
import { BrandTab } from "./tabs/BrandTab";
import { ChatTab } from "./tabs/ChatTab";
import { LaunchTab } from "./tabs/LaunchTab";
import { LearningTab } from "./tabs/LearningTab";
import { LibraryTab } from "./tabs/LibraryTab";
import { PostBriefsTab } from "./tabs/PostBriefsTab";
import { ProductsTab } from "./tabs/ProductsTab";
import { ReviewTab } from "./tabs/ReviewTab";
import { SettingsTab } from "./tabs/SettingsTab";`;

if (!content.includes('from "./tabs/ProductsTab"')) {
  content = content.replace(
    'import { SectionTitle } from "./shared/SectionTitle";',
    `import { SectionTitle } from "./shared/SectionTitle";\n${importBlock}`,
  );
}

const replacement = `        {(state.activeSection === "dashboard" ||
          state.activeSection === "setup") && (
          <ProductsTab
            sectionRefs={sectionRefs}
            state={state}
            selectedProduct={selectedProduct}
            selectedProductLabel={selectedProductLabel}
            saveStatus={saveStatus}
            catalogProducts={catalogProducts}
            productFieldSuggestions={productFieldSuggestions}
            activeEditors={activeEditors}
            selectActiveProduct={selectActiveProduct}
            deleteProduct={deleteProduct}
            openCatalogPicker={openCatalogPicker}
            addManualProduct={addManualProduct}
            updateProduct={updateProduct}
            aiFillProductFields={aiFillProductFields}
            aiFillStatus={aiFillStatus}
            textMatchesAiSuggestion={textMatchesAiSuggestion}
            listMatchesAiSuggestion={listMatchesAiSuggestion}
            upgradeStrategyList={upgradeStrategyList}
            strategyUpgradeField={strategyUpgradeField}
            enhanceStrategyDraft={enhanceStrategyDraft}
            strategyEnhanceField={strategyEnhanceField}
          />
        )}

        {state.activeSection === "sources" && state.products.length ? (
          <LibraryTab
            sectionRefs={sectionRefs}
            productSources={productSources}
            productSourceGroups={productSourceGroups}
            sourceLinkRows={sourceLinkRows}
            sourceLinkError={sourceLinkError}
            sourceLinkStatus={sourceLinkStatus}
            sourceLinkValues={sourceLinkValues}
            activeLibraryFolderKey={activeLibraryFolderKey}
            updateSourceLinkRow={updateSourceLinkRow}
            addSourceLinkRow={addSourceLinkRow}
            removeSourceLinkRow={removeSourceLinkRow}
            addSourceLinks={addSourceLinks}
            importDriveLinksToLibrary={importDriveLinksToLibrary}
            uploadSourceFiles={uploadSourceFiles}
            setActiveLibraryFolderKey={setActiveLibraryFolderKey}
            setLibraryPreviewSourceId={setLibraryPreviewSourceId}
            deleteSourceGroup={deleteSourceGroup}
            updateLibrarySourceStatus={updateLibrarySourceStatus}
          />
        ) : null}

        {canManageAccess && state.activeSection === "brand" ? (
          <BrandTab
            sectionRefs={sectionRefs}
            brand={state.brand}
            companyName={companyName}
            brandFillStatus={brandFillStatus}
            brandFillError={brandFillError}
            magicFillBrand={magicFillBrand}
            updateBrand={updateBrand}
            addBrandReferenceLink={addBrandReferenceLink}
            updateBrandReferenceLink={updateBrandReferenceLink}
            removeBrandReferenceLink={removeBrandReferenceLink}
          />
        ) : null}

        {state.activeSection === "tasks" && (
          <PostBriefsTab
            sectionRefs={sectionRefs}
            state={state}
            selectedProduct={selectedProduct}
            taskDraft={taskDraft}
            setTaskDraft={setTaskDraft}
            productTaskSources={productTaskSources}
            productTaskSelectionGroups={productTaskSelectionGroups}
            productSources={productSources}
            selectedTaskSource={selectedTaskSource}
            selectedTaskSourceGroup={selectedTaskSourceGroup}
            activeEditors={activeEditors}
            selectedEditorIds={selectedEditorIds}
            setSelectedEditorIds={setSelectedEditorIds}
            selectedEditorPermissions={selectedEditorPermissions}
            canManageAccess={canManageAccess}
            teamMemberLabel={teamMemberLabel}
            optionalTeamText={optionalTeamText}
            selectedBriefPersonas={selectedBriefPersonas}
            applyBriefStrategyPick={applyBriefStrategyPick}
            setActiveSection={setActiveSection}
            aiFillBriefDraft={aiFillBriefDraft}
            briefAiStatus={briefAiStatus}
            briefAiReason={briefAiReason}
            defaultAngle={defaultAngle}
            defaultHook={defaultHook}
            taskError={taskError}
            postBriefDraft={postBriefDraft}
            briefCreateStatus={briefCreateStatus}
            productBuildTasks={productBuildTasks}
            productFinishedTasks={productFinishedTasks}
            productDeletedTasks={productDeletedTasks}
            productEdits={productEdits}
            briefEditDrafts={briefEditDrafts}
            briefNameEdits={briefNameEdits}
            setBriefNameEdits={setBriefNameEdits}
            selectActiveProduct={selectActiveProduct}
            openCatalogPicker={openCatalogPicker}
            saveEditedBrief={saveEditedBrief}
            cancelEditingBrief={cancelEditingBrief}
            updateBriefEditDraft={updateBriefEditDraft}
            startEditingBrief={startEditingBrief}
            cancelEditingBriefName={cancelEditingBriefName}
            updatePostedBriefName={updatePostedBriefName}
            openChatRoom={openChatRoom}
            deleteTask={deleteTask}
            restoreTask={restoreTask}
            permanentlyDeleteTask={permanentlyDeleteTask}
            sourceDraftOptionExists={sourceDraftOptionExists}
            sourceLabelByDraftValue={sourceLabelByDraftValue}
          />
        )}

        {state.activeSection === "chat" && (
          <ChatTab
            sectionRefs={sectionRefs}
            chatRooms={chatRooms}
            activeChatRoom={activeChatRoom}
            activeChatMessages={activeChatMessages}
            userEmail={userEmail}
            tenantId={tenantId}
            chatDrafts={chatDrafts}
            setSelectedChatRoomId={setSelectedChatRoomId}
            setChatDrafts={setChatDrafts}
            sendChatMessage={sendChatMessage}
          />
        )}

        {state.activeSection === "review" && (
          <ReviewTab
            sectionRefs={sectionRefs}
            state={state}
            readyAdRows={readyAdRows}
            readyAdError={readyAdError}
            reviewActionError={reviewActionError}
            workspaceReviews={workspaceReviews}
            workspaceEdits={workspaceEdits}
            productNameById={productNameById}
            revisionSendStatus={revisionSendStatus}
            updateReadyAdRow={updateReadyAdRow}
            addReadyAdRow={addReadyAdRow}
            removeReadyAdRow={removeReadyAdRow}
            addReadyAdsToReview={addReadyAdsToReview}
            updateReviewFeedback={updateReviewFeedback}
            approveReview={approveReview}
            requestRevision={requestRevision}
            rejectReview={rejectReview}
          />
        )}

        {state.activeSection === "launch" && (
          <LaunchTab
            sectionRefs={sectionRefs}
            workspaceLaunchItems={workspaceLaunchItems}
            productNameById={productNameById}
            updateLaunchStatus={updateLaunchStatus}
          />
        )}

        {state.activeSection === "learning" && (
          <LearningTab
            sectionRefs={sectionRefs}
            workspacePerformance={workspacePerformance}
          />
        )}

        {canManageAccess && state.activeSection === "access" && (
          <SettingsTab
            sectionRefs={sectionRefs}
            editorDraft={editorDraft}
            setEditorDraft={setEditorDraft}
            editorError={editorError}
            setEditorError={setEditorError}
            editorInviteStatus={editorInviteStatus}
            inviteEditor={inviteEditor}
            acceptedPermissions={acceptedPermissions}
            pendingPermissions={pendingPermissions}
            accessPermissionHistory={accessPermissionHistory}
            deletingInviteHistoryIds={deletingInviteHistoryIds}
            removeEditor={removeEditor}
            resendInvite={resendInvite}
            inviteAgain={inviteAgain}
            deleteInviteHistory={deleteInviteHistory}
          />
        )}`;

const startIdx = lines.findIndex((line) =>
  line.includes('(state.activeSection === "dashboard"'),
);
const endIdx = lines.findIndex(
  (line, idx) =>
    idx > startIdx &&
    line.trim() === ")}" &&
    lines[idx - 1]?.includes("access") &&
    lines[idx - 2]?.trim() === "</div>",
);

// More reliable: find line 4662 pattern
const startLine = lines.findIndex(
  (l) =>
    l.trim() === `{(state.activeSection === "dashboard" ||` ||
    l.includes('state.activeSection === "dashboard"'),
);
let endLine = -1;
for (let i = lines.length - 1; i >= startLine; i--) {
  if (
    lines[i].includes("canManageAccess && state.activeSection === \"access\"") ||
    (lines[i].trim() === ")}" && lines[i - 1]?.trim() === "</div>")
  ) {
    // find closing of access section
  }
}

// Use fixed line numbers from earlier grep
const START = 4661; // 0-indexed: line 4662
const END = 6841; // exclusive end for slice (line 6842 is `)}`)

const newLines = [
  ...lines.slice(0, START),
  ...replacement.split("\n"),
  ...lines.slice(END),
];
fs.writeFileSync(path, newLines.join("\n"));
console.log("Spliced owner tabs", START, END, "->", newLines.length, "lines");

// Remove duplicate helper block
let updated = fs.readFileSync(path, "utf8").split(/\r?\n/);
const editorStart = updated.findIndex((l) => l.startsWith("function BrandReferenceLinksEditor"));
const keepStart = updated.findIndex((l) => l.startsWith("function BrandReferenceLinksCard"));
if (editorStart >= 0 && keepStart > editorStart) {
  updated = [
    ...updated.slice(0, editorStart),
    ...updated.slice(keepStart),
  ];
  fs.writeFileSync(path, updated.join("\n"));
  console.log("Removed duplicate widgets from workspace, new length", updated.length);
}
