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
} from "../types";

const uid = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

export function createCardObject(payload: CardPayload): SnippetCard {
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


export function createMetricEntry(title = "New Metric", value = "0"): MetricEntry {
  return {
    id: uid('metric-entry'),
    title,
    value,
  }
}

