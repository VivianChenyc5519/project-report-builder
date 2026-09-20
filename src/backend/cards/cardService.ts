import type { SnippetCard, MetricCard, MetricEntry, CardPayload } from "../types";

import { createCardObject, createMetricEntry } from "./cardFactory";
import * as cardRepo from './cardRepository';

const uid = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

export function createCard(payload: CardPayload): SnippetCard {
    const card = createCardObject(payload);
    cardRepo.saveCard(card);
    return card;
}

export function addMetricCardEntry(card: MetricCard): MetricCard {
    const newEntry = createMetricEntry();

    const updated = {
        ...card,
        entries: [
            ...card.entries,
            newEntry
        ]
    };
    updateCard(card, updated);
    return updated;
}

export function mergeCards(
  target: SnippetCard,
  copied: SnippetCard,
): SnippetCard {
  if (target.type !== copied.type) {
    return target;
  }
  if (target.type === "metric" && copied.type === "metric") {
    const merged = {
      ...target,
      entries: [
        ...target.entries,
        ...copied.entries.map((entry) => ({
          ...entry,
          id: uid("metric-entry"),
        })),
      ],
    };
    updateCard(target, merged);
    return merged;
  }

  if (target.type === "milestone" && copied.type === "milestone") {
    const merged = {
      ...target,
      description: [target.description, copied.description]
        .filter(Boolean)
        .join("\n\n"),
    };
    updateCard(target, merged);
    return merged;
  }

  if (target.type === "risk" && copied.type === "risk") {
    const merged = {
      ...target,
      description: [target.description, copied.description]
        .filter(Boolean)
        .join("\n\n"),
      mitigation: [target.mitigation, copied.mitigation]
        .filter(Boolean)
        .join("\n\n"),
    };
    updateCard(target, merged);
    return merged;
  }

  if (target.type === "image" && copied.type === "image") {
    const merged =  {
      ...target,
      caption: [target.caption, copied.caption].filter(Boolean).join(" · "),
    };
    updateCard(target, merged);
    return merged;
  }
  console.error("Card type does not support merging for now");
  return target;
}

export function removeMetricEntry(
  card: MetricCard,
  entryId: string,
): MetricCard {
  const removed = {
    ...card,
    entries: card.entries.filter((entry) => entry.id !== entryId),
  };
  updateCard(card, removed);
  return removed;
}

export function updateMetricEntry(
  card: MetricCard,
  entryId: string,
  patch: Partial<MetricEntry>,
): MetricCard {
  const updated = {
    ...card,
    entries: card.entries.map((entry) =>
      entry.id === entryId
        ? {
            ...entry,
            ...patch,
          }
        : entry,
    ),
  };
  updateCard(card, updated);
  return updated;
}

export function updateCard<T extends SnippetCard>(
  card: T,
  patch: Partial<T>,
): T {
  const updated = {
    ...card,
    ...patch,
  };
  try {
    cardRepo.updateStoredCard(card.projectId, card.id, updated);
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
  }
  
  return updated;
}

export function deleteCard(card: SnippetCard) : void {
    try {
        cardRepo.deleteStoredCard(card.projectId, card.id);
    } catch (error: unknown) {
      console.error(error instanceof Error ? error.message : error);
    }
    return;
}
