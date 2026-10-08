type Navigate = (href: string) => void;

let navigate: Navigate = (href) => {
  window.location.assign(href);
};

/** Lets non-React code (toasts, realtime handlers) use the Next.js router. */
export function setNavigator(next: Navigate): void {
  navigate = next;
}

export function navigateTo(href: string): void {
  navigate(href);
}

export const chatPath = (conversationId: number) => `/chats/${conversationId}`;
