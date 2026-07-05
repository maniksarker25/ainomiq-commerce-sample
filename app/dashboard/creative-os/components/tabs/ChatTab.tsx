"use client";

import { normalizeEmail } from "../../lib/products";
import { ChatPanel } from "../shared/WorkspaceWidgets";
import type { ChatTabProps } from "./types";

export function ChatTab(props: ChatTabProps) {
  const {
    sectionRefs,
    chatRooms,
    activeChatRoom,
    activeChatMessages,
    userEmail,
    tenantId,
    chatDrafts,
    setSelectedChatRoomId,
    setChatDrafts,
    sendChatMessage,
    deleteChatMessage,
  } = props;
  return (
    <>
      <div
        ref={(el) => {
          sectionRefs.current.chat = el;
        }}
      >
        <ChatPanel
          emptyText="No brief chats yet. Post a brief to open a chat room."
          rooms={chatRooms}
          selectedRoomId={activeChatRoom?.id || ""}
          messages={activeChatMessages}
          currentUserEmail={normalizeEmail(userEmail || tenantId)}
          draft={activeChatRoom ? chatDrafts[activeChatRoom.id] || "" : ""}
          onSelectRoom={setSelectedChatRoomId}
          onDraftChange={(value) =>
            activeChatRoom &&
            setChatDrafts((current) => ({
              ...current,
              [activeChatRoom.id]: value,
            }))
          }
          onSend={() =>
            activeChatRoom && sendChatMessage(activeChatRoom.id)
          }
          onDeleteMessage={deleteChatMessage}
        />
      </div>
    </>
  );
}
