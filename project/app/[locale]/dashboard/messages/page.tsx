'use client';

// Client-side messages — the same shared thread view as the talent side, scoped to
// the conversations where you're the client. Wrapped by the dashboard layout.
import MessagesView from '@/components/marketplace/MessagesView';

export default function ClientMessagesPage() {
  return <MessagesView embedded filterRole="client" />;
}
