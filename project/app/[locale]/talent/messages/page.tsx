'use client';

// Messages inside the talent dashboard — wrapped by app/[locale]/talent/layout
// (sidebar + navbar clearance), so the shared view renders embedded.
import MessagesView from '@/components/marketplace/MessagesView';

export default function TalentMessagesPage() {
  return <MessagesView embedded filterRole="talent" />;
}
