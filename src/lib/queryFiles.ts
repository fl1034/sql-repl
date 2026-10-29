import { useDuckStore } from "@/store";
import type { SavedQuery } from "@/services/persistence/repositories/savedQueryRepository";
import { getSetting, setSetting } from "@/services/persistence/repositories/settingsRepository";

export function linkQueryFile(tabId: string, query: SavedQuery): void {
  useDuckStore.setState((state) => ({
    tabs: state.tabs.map((tab) =>
      tab.id === tabId ? { ...tab, savedQueryId: query.id, title: query.name } : tab
    ),
  }));
}

export function openQueryFile(query: SavedQuery): string {
  const state = useDuckStore.getState();
  const existing = state.tabs.find((tab) => tab.savedQueryId === query.id);
  if (existing) {
    state.setActiveTab(existing.id);
    return existing.id;
  }
  const id = state.createTab("sql", query.sql_text, query.name);
  linkQueryFile(id, query);
  return id;
}

export async function getQueryFolders(profileId: string): Promise<string[]> {
  const raw = await getSetting(profileId, "queries", "folders");
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function saveQueryFolders(profileId: string, folders: string[]): Promise<void> {
  await setSetting(profileId, "queries", "folders", JSON.stringify([...new Set(folders)].sort()));
}

export const isUntitledQuery = (title: string): boolean =>
  /^(untitled(?: query)?|query(?:\s+\d+)?)$/i.test(title.trim());
