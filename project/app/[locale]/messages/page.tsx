'use client';

// Standalone messages page (client area). Talents use /talent/messages, which
// renders the same view inside the talent dashboard chrome.
import MessagesView from '@/components/marketplace/MessagesView';

export default function MessagesPage() {
  return <MessagesView />;
}
