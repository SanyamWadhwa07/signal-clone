import { EmptyPane } from "@/components/layout/empty-state";

export default function ChatsIndexPage() {
  return (
    <EmptyPane title="Select a chat to start messaging">
      Messages are end-to-end encrypted. Only you and the people you message can read them.
    </EmptyPane>
  );
}
