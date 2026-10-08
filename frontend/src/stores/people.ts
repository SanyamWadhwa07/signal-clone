import { create } from "zustand";

import { contactsApi, groupsApi, type Contact, type Member, type UserPublic } from "@/lib/api";

interface PeopleState {
  /** Every user we've seen so far (peers, contacts, group members), by id. */
  users: Record<number, UserPublic>;
  contacts: Contact[];
  contactsLoaded: boolean;
  membersByConversation: Record<number, Member[]>;

  upsertUsers: (users: UserPublic[]) => void;
  loadContacts: () => Promise<void>;
  addContact: (input: { phone?: string; username?: string; nickname?: string }) => Promise<Contact>;
  renameContact: (id: number, nickname: string | null) => Promise<void>;
  removeContact: (id: number) => Promise<void>;
  loadMembers: (conversationId: number) => Promise<Member[]>;
  setMembers: (conversationId: number, members: Member[]) => void;
  reset: () => void;
}

const initial = {
  users: {} as Record<number, UserPublic>,
  contacts: [] as Contact[],
  contactsLoaded: false,
  membersByConversation: {} as Record<number, Member[]>,
};

function indexUsers(existing: Record<number, UserPublic>, users: UserPublic[]) {
  const next = { ...existing };
  for (const user of users) next[user.id] = { ...next[user.id], ...user };
  return next;
}

export const usePeopleStore = create<PeopleState>((set, get) => ({
  ...initial,

  upsertUsers: (users) => set((state) => ({ users: indexUsers(state.users, users) })),

  loadContacts: async () => {
    const contacts = await contactsApi.list();
    set((state) => ({
      contacts,
      contactsLoaded: true,
      users: indexUsers(
        state.users,
        contacts.map((c) => c.user),
      ),
    }));
  },

  addContact: async (input) => {
    const contact = await contactsApi.add(input);
    set((state) => ({
      contacts: [...state.contacts.filter((c) => c.id !== contact.id), contact],
      users: indexUsers(state.users, [contact.user]),
    }));
    return contact;
  },

  renameContact: async (id, nickname) => {
    const updated = await contactsApi.rename(id, nickname);
    set((state) => ({ contacts: state.contacts.map((c) => (c.id === id ? updated : c)) }));
  },

  removeContact: async (id) => {
    await contactsApi.remove(id);
    set((state) => ({ contacts: state.contacts.filter((c) => c.id !== id) }));
  },

  loadMembers: async (conversationId) => {
    const members = await groupsApi.members(conversationId);
    get().setMembers(conversationId, members);
    return members;
  },

  setMembers: (conversationId, members) =>
    set((state) => ({
      membersByConversation: { ...state.membersByConversation, [conversationId]: members },
      users: indexUsers(
        state.users,
        members.map((m) => m.user),
      ),
    })),

  reset: () => set({ ...initial }),
}));

/** Name shown for a user: your nickname for them, else their profile name, else their number. */
export function displayNameFor(
  state: Pick<PeopleState, "users" | "contacts">,
  userId: number,
): string | undefined {
  const nickname = state.contacts.find((c) => c.user.id === userId)?.nickname;
  return nickname ?? state.users[userId]?.display_name;
}
