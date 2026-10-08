"use client";

import { useEffect, useState } from "react";

import { searchApi, type SearchResult } from "@/lib/api";

const MIN_LENGTH = 2;
const DEBOUNCE_MS = 250;

/** Debounced server search; stale responses are aborted so results never arrive out of order. */
export function useServerSearch(query: string): { result: SearchResult | null; loading: boolean } {
  const term = query.trim();
  const active = term.length >= MIN_LENGTH;
  const [state, setState] = useState<{ term: string; result: SearchResult | null }>({
    term: "",
    result: null,
  });

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchApi
        .search(term, controller.signal)
        .then((result) => setState({ term, result }))
        .catch(() => {});
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, active]);

  if (!active) return { result: null, loading: false };
  return { result: state.term === term ? state.result : null, loading: state.term !== term };
}
