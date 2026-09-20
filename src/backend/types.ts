export type CardType = 'metric' | 'milestone' | 'image' | "risk";
export type RiskLevel = 'high' | 'medium' | 'low';
export type CardSource = 'auto' | 'manual';
export type CardStatus = 'planned' | 'in-progress' | 'completed';

interface BaseCard {
  id: string;
  projectId: string;
  type: CardType;
  title: string;
  source: CardSource;
}

export type CardPayload =
  | {
      type: "metric";
      projectId: string;
      source: CardSource;
      title: string;
      value: string;
    }
  | {
      type: "milestone";
      projectId: string;
      source: CardSource;
      title: string;
      description?: string;
      status?: CardStatus;
      date?: string;
    }
  | {
      type: "risk";
      projectId: string;
      source: CardSource;
      title: string;
      description?: string;
      probability?: RiskLevel;
      impact?: RiskLevel;
      mitigation?: string;
    }
  | {
      type: "image";
      projectId: string;
      source: CardSource;
      imageUrl: string;
    };

export interface MetricEntry {
  id: string;
  title: string;
  value: string;
}

export interface MetricCard extends BaseCard {
  type: 'metric';
  entries: MetricEntry[];
}

export interface MilestoneCard extends BaseCard {
  type: 'milestone';
  description: string;
  status: CardStatus;
  date?: string;
}

export interface ImageCard extends BaseCard {
  type: 'image';
  imageUrl: string;
  caption?: string;
  altText: string;
}

export interface RiskCard extends BaseCard {
  type: "risk";
  description: string;
  probability: RiskLevel;
  impact: RiskLevel;
  mitigation?: string;
}

export type SnippetCard = MetricCard | MilestoneCard | ImageCard | RiskCard;

export interface Project {
  id: string;
  name: string;
  cards: SnippetCard[];
}

