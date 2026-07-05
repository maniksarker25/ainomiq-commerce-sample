import fs from "fs";
import path from "path";

const tabsDir = "app/dashboard/creative-os/components/tabs";

const destructureByFile = {
  "ProductsTab.tsx": [
    "sectionRefs",
    "state",
    "selectedProduct",
    "selectedProductLabel",
    "saveStatus",
    "catalogProducts",
    "productFieldSuggestions",
    "activeEditors",
    "selectActiveProduct",
    "deleteProduct",
    "openCatalogPicker",
    "addManualProduct",
    "updateProduct",
    "aiFillProductFields",
    "aiFillStatus",
    "textMatchesAiSuggestion",
    "listMatchesAiSuggestion",
    "upgradeStrategyList",
    "strategyUpgradeField",
    "enhanceStrategyDraft",
    "strategyEnhanceField",
  ],
  "LibraryTab.tsx": [
    "sectionRefs",
    "productSources",
    "productSourceGroups",
    "sourceLinkRows",
    "sourceLinkError",
    "sourceLinkStatus",
    "sourceLinkValues",
    "activeLibraryFolderKey",
    "updateSourceLinkRow",
    "addSourceLinkRow",
    "removeSourceLinkRow",
    "addSourceLinks",
    "importDriveLinksToLibrary",
    "uploadSourceFiles",
    "setActiveLibraryFolderKey",
    "setLibraryPreviewSourceId",
    "deleteSourceGroup",
    "updateLibrarySourceStatus",
  ],
  "BrandTab.tsx": [
    "sectionRefs",
    "brand",
    "companyName",
    "brandFillStatus",
    "brandFillError",
    "magicFillBrand",
    "updateBrand",
    "addBrandReferenceLink",
    "updateBrandReferenceLink",
    "removeBrandReferenceLink",
  ],
  "PostBriefsTab.tsx": [
    "sectionRefs",
    "state",
    "selectedProduct",
    "taskDraft",
    "setTaskDraft",
    "productTaskSources",
    "productTaskSelectionGroups",
    "productSources",
    "selectedTaskSource",
    "selectedTaskSourceGroup",
    "activeEditors",
    "selectedEditorIds",
    "setSelectedEditorIds",
    "selectedEditorPermissions",
    "canManageAccess",
    "teamMemberLabel",
    "optionalTeamText",
    "selectedBriefPersonas",
    "applyBriefStrategyPick",
    "setActiveSection",
    "aiFillBriefDraft",
    "briefAiStatus",
    "briefAiReason",
    "defaultAngle",
    "defaultHook",
    "taskError",
    "postBriefDraft",
    "briefCreateStatus",
    "productBuildTasks",
    "productFinishedTasks",
    "productDeletedTasks",
    "productEdits",
    "briefEditDrafts",
    "briefNameEdits",
    "setBriefNameEdits",
    "selectActiveProduct",
    "openCatalogPicker",
    "saveEditedBrief",
    "cancelEditingBrief",
    "updateBriefEditDraft",
    "startEditingBrief",
    "cancelEditingBriefName",
    "updatePostedBriefName",
    "openChatRoom",
    "deleteTask",
    "restoreTask",
    "permanentlyDeleteTask",
    "sourceDraftOptionExists",
    "sourceLabelByDraftValue",
  ],
  "ChatTab.tsx": [
    "sectionRefs",
    "chatRooms",
    "activeChatRoom",
    "activeChatMessages",
    "userEmail",
    "tenantId",
    "chatDrafts",
    "setSelectedChatRoomId",
    "setChatDrafts",
    "sendChatMessage",
  ],
  "ReviewTab.tsx": [
    "sectionRefs",
    "state",
    "readyAdRows",
    "readyAdError",
    "reviewActionError",
    "workspaceReviews",
    "workspaceEdits",
    "productNameById",
    "revisionSendStatus",
    "updateReadyAdRow",
    "addReadyAdRow",
    "removeReadyAdRow",
    "addReadyAdsToReview",
    "updateReviewFeedback",
    "approveReview",
    "requestRevision",
    "rejectReview",
  ],
  "LaunchTab.tsx": [
    "sectionRefs",
    "workspaceLaunchItems",
    "productNameById",
    "updateLaunchStatus",
  ],
  "LearningTab.tsx": ["sectionRefs", "workspacePerformance"],
  "SettingsTab.tsx": [
    "sectionRefs",
    "editorDraft",
    "setEditorDraft",
    "editorError",
    "setEditorError",
    "editorInviteStatus",
    "inviteEditor",
    "acceptedPermissions",
    "pendingPermissions",
    "accessPermissionHistory",
    "deletingInviteHistoryIds",
    "removeEditor",
    "resendInvite",
    "inviteAgain",
    "deleteInviteHistory",
  ],
};

for (const [file, keys] of Object.entries(destructureByFile)) {
  const filePath = path.join(tabsDir, file);
  let content = fs.readFileSync(filePath, "utf8");
  content = content.replace(
    /const \{\s*\} = props;/,
    `const {\n    ${keys.join(",\n    ")},\n  } = props;`,
  );
  content = content.replace(
    /props\.sectionRefs\.(\w+) = el/g,
    "sectionRefs.current.$1 = el",
  );
  if (file === "BrandTab.tsx") {
    content = content.replace(/\bstate\.brand\b/g, "brand");
  }
  if (file === "ChatTab.tsx" && !content.includes("normalizeEmail")) {
    content = content.replace(
      'import type { ChatTabProps } from "./types";',
      'import { normalizeEmail } from "../../lib/products";\nimport type { ChatTabProps } from "./types";',
    );
  }
  if (file === "ProductsTab.tsx" && !content.includes("catalogDisplayName")) {
    content = content.replace(
      'import type { ProductsTabProps } from "./types";',
      'import { catalogDisplayName } from "../../lib/products";\nimport type { ProductsTabProps } from "./types";',
    );
  }
  if (file === "PostBriefsTab.tsx" && !content.includes("catalogDisplayName")) {
    // already has catalogDisplayName import
  }
  if (file === "BrandTab.tsx") {
    content = content.replace(
      /value=\{state\.brand\.(\w+)\}/g,
      "value={brand.$1}",
    );
  }
  fs.writeFileSync(filePath, content);
  console.log("Fixed", file);
}
