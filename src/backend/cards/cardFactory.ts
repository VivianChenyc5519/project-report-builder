import type {
  SnippetCard,
  MetricCard,
  MilestoneCard,
  RiskCard,
  ImageCard,
  RiskLevel,
  CardSource,
  CardStatus,
  MetricEntry,
  CardPayload
} from "./types";

const uid = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

export function createCard(payload: CardPayload): SnippetCard {
  switch (payload.type) {
    case "metric":
      return {
        id: uid("metric"),
        projectId: payload.projectId,
        type: "metric",
        title: payload.title,
        source: payload.source,
        entries: [
          {
            id: uid("metric-entry"),
            title: payload.title,
            value: payload.value,
          },
        ],
      };

    case "milestone":
      return {
        id: uid("milestone"),
        projectId: payload.projectId,
        type: "milestone",
        title: payload.title,
        description: payload.description ?? "",
        status: payload.status ?? "in-progress",
        date: payload.date,
        source: payload.source,
      };

    case "risk":
      return {
        id: uid("risk"),
        projectId: payload.projectId,
        type: "risk",
        title: payload.title,
        description: payload.description ?? "",
        probability: payload.probability ?? "medium",
        impact: payload.impact ?? "medium",
        mitigation: payload.mitigation ?? "",
        source: payload.source,
      };

    case "image":
      return {
        id: uid("image"),
        projectId: payload.projectId,
        type: "image",
        title: "",
        imageUrl: payload.imageUrl,
        caption: "",
        altText: "",
        source: payload.source,
      };
  }
}

export function mergeCards(
  target: SnippetCard,
  copied: SnippetCard,
): SnippetCard {
  if (target.type !== copied.type) {
    return target;
  }

  if (target.type === "metric" && copied.type === "metric") {
    return {
      ...target,
      entries: [
        ...target.entries,
        ...copied.entries.map((entry) => ({
          ...entry,
          id: uid("metric-entry"),
        })),
      ],
    };
  }

  if (target.type === "milestone" && copied.type === "milestone") {
    return {
      ...target,
      description: [target.description, copied.description]
        .filter(Boolean)
        .join("\n\n"),
    };
  }

  if (target.type === "risk" && copied.type === "risk") {
    return {
      ...target,
      description: [target.description, copied.description]
        .filter(Boolean)
        .join("\n\n"),
      mitigation: [target.mitigation, copied.mitigation]
        .filter(Boolean)
        .join("\n\n"),
    };
  }

  if (target.type === "image" && copied.type === "image") {
    return {
      ...target,
      caption: [target.caption, copied.caption].filter(Boolean).join(" · "),
    };
  }

  return target;
}

export function createMetricEntry(title = "New Metric", value = "0"): MetricEntry {
  return {
    id: uid('metric-entry'),
    title,
    value,
  }
}

export function removeMetricEntry(
  card: MetricCard,
  entryId: string
): MetricCard {
  return {
    ...card,
    entries: card.entries.filter(
      (entry) => entry.id !== entryId
    )
  };
}

export function updateMetricEntry(
  card: MetricCard,
  entryId: string,
  patch: Partial<MetricEntry>
): MetricCard {
  return {
    ...card,
    entries: card.entries.map((entry) =>
      entry.id === entryId
        ? {
            ...entry,
            ...patch
          }
        : entry
    )
  };
}

export function updateCard<T extends SnippetCard>(
  card: T,
  patch: Partial<T>
): T {
  return {
    ...card,
    ...patch
  };
}
