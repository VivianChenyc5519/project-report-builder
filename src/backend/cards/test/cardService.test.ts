import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CardPayload,
  ImageCard,
  MetricCard,
  MilestoneCard,
  RiskCard,
  SnippetCard,
} from '../../types';
import * as cardFactory from '../cardFactory';
import * as cardRepo from '../cardRepository';
import {
  addMetricCardEntry,
  createCard,
  deleteCard,
  mergeCards,
  removeMetricEntry,
  updateCard,
  updateMetricEntry,
} from '../cardService';

vi.mock('../cardRepository', () => ({
  saveCard: vi.fn(),
  updateStoredCard: vi.fn(),
  deleteStoredCard: vi.fn(),
}));

vi.mock('../cardFactory', () => ({
  createCardObject: vi.fn(),
  createMetricEntry: vi.fn(),
}));

const metricCard = (overrides: Partial<MetricCard> = {}): MetricCard => ({
  id: 'metric-1',
  projectId: 'project-1',
  type: 'metric',
  title: 'Revenue',
  source: 'manual' as MetricCard['source'],
  entries: [
    { id: 'entry-1', title: 'Revenue', value: '100' },
    { id: 'entry-2', title: 'Users', value: '20' },
  ],
  ...overrides,
});

const milestoneCard = (overrides: Partial<MilestoneCard> = {}): MilestoneCard => ({
  id: 'milestone-1',
  projectId: 'project-1',
  type: 'milestone',
  title: 'Launch',
  description: 'First description',
  status: 'in-progress' as MilestoneCard['status'],
  date: '2026-10-01',
  source: 'manual' as MilestoneCard['source'],
  ...overrides,
});

const riskCard = (overrides: Partial<RiskCard> = {}): RiskCard => ({
  id: 'risk-1',
  projectId: 'project-1',
  type: 'risk',
  title: 'Dependency risk',
  description: 'First risk',
  probability: 'medium' as RiskCard['probability'],
  impact: 'medium' as RiskCard['impact'],
  mitigation: 'First mitigation',
  source: 'manual' as RiskCard['source'],
  ...overrides,
});

const imageCard = (overrides: Partial<ImageCard> = {}): ImageCard => ({
  id: 'image-1',
  projectId: 'project-1',
  type: 'image',
  title: '',
  imageUrl: 'https://example.com/one.png',
  caption: 'First caption',
  altText: '',
  source: 'manual' as ImageCard['source'],
  ...overrides,
});

describe('cardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createCard', () => {
    it('creates a card through the factory, stores it, and returns it', () => {
      const payload = {
        type: 'metric',
        projectId: 'project-1',
        title: 'Revenue',
        value: '100',
        source: 'manual',
      } as CardPayload;
      const created = metricCard();
      vi.mocked(cardFactory.createCardObject).mockReturnValue(created);

      const result = createCard(payload);

      expect(cardFactory.createCardObject).toHaveBeenCalledWith(payload);
      expect(cardRepo.saveCard).toHaveBeenCalledWith(created);
      expect(result).toBe(created);
    });
  });

  describe('metric entry operations', () => {
    it('adds a new metric entry and persists the updated card', () => {
      const card = metricCard();
      const newEntry = { id: 'entry-3', title: 'New Metric', value: '0' };
      vi.mocked(cardFactory.createMetricEntry).mockReturnValue(newEntry);

      const result = addMetricCardEntry(card);

      expect(result.entries).toEqual([...card.entries, newEntry]);
      expect(cardRepo.updateStoredCard).toHaveBeenCalledWith(
        card.projectId,
        card.id,
        result,
      );
      expect(card.entries).toHaveLength(2);
    });

    it('removes only the requested metric entry', () => {
      const card = metricCard();

      const result = removeMetricEntry(card, 'entry-1');

      expect(result.entries).toEqual([
        { id: 'entry-2', title: 'Users', value: '20' },
      ]);
      expect(cardRepo.updateStoredCard).toHaveBeenCalledWith(
        card.projectId,
        card.id,
        result,
      );
    });

    it('leaves entries unchanged when removing an unknown id', () => {
      const card = metricCard();

      const result = removeMetricEntry(card, 'missing');

      expect(result.entries).toEqual(card.entries);
      expect(result).not.toBe(card);
    });

    it('patches only the requested metric entry', () => {
      const card = metricCard();

      const result = updateMetricEntry(card, 'entry-2', {
        title: 'Active users',
        value: '25',
      });

      expect(result.entries).toEqual([
        card.entries[0],
        { id: 'entry-2', title: 'Active users', value: '25' },
      ]);
      expect(cardRepo.updateStoredCard).toHaveBeenCalledWith(
        card.projectId,
        card.id,
        result,
      );
    });
  });

  describe('mergeCards', () => {
    it('returns the target unchanged and does not persist when types differ', () => {
      const target = metricCard();
      const copied = milestoneCard();

      const result = mergeCards(target, copied);

      expect(result).toBe(target);
      expect(cardRepo.updateStoredCard).not.toHaveBeenCalled();
    });

    it('merges metric entries and assigns copied entries new ids', () => {
      const target = metricCard({ entries: [{ id: 'target-entry', title: 'A', value: '1' }] });
      const copied = metricCard({
        id: 'metric-2',
        entries: [{ id: 'copied-entry', title: 'B', value: '2' }],
      });
      vi.spyOn(Math, 'random').mockReturnValue(0.456789);

      const result = mergeCards(target, copied) as MetricCard;

      expect(result.entries).toHaveLength(2);
      expect(result.entries[0]).toEqual(target.entries[0]);
      expect(result.entries[1]).toMatchObject({ title: 'B', value: '2' });
      expect(result.entries[1].id).toMatch(/^metric-entry-/);
      expect(result.entries[1].id).not.toBe('copied-entry');
      expect(cardRepo.updateStoredCard).toHaveBeenCalledWith(
        target.projectId,
        target.id,
        result,
      );
    });

    it('merges milestone descriptions with a blank line separator', () => {
      const target = milestoneCard({ description: 'Target description' });
      const copied = milestoneCard({ id: 'milestone-2', description: 'Copied description' });

      const result = mergeCards(target, copied) as MilestoneCard;

      expect(result.description).toBe('Target description\n\nCopied description');
    });

    it('does not add separators for blank milestone descriptions', () => {
      const target = milestoneCard({ description: '' });
      const copied = milestoneCard({ id: 'milestone-2', description: 'Copied description' });

      const result = mergeCards(target, copied) as MilestoneCard;

      expect(result.description).toBe('Copied description');
    });

    it('merges risk descriptions and mitigations independently', () => {
      const target = riskCard({ description: 'Risk A', mitigation: 'Mitigation A' });
      const copied = riskCard({
        id: 'risk-2',
        description: 'Risk B',
        mitigation: 'Mitigation B',
      });

      const result = mergeCards(target, copied) as RiskCard;

      expect(result.description).toBe('Risk A\n\nRisk B');
      expect(result.mitigation).toBe('Mitigation A\n\nMitigation B');
    });

    it('merges image captions with a middle dot separator', () => {
      const target = imageCard({ caption: 'Front' });
      const copied = imageCard({ id: 'image-2', caption: 'Back' });

      const result = mergeCards(target, copied) as ImageCard;

      expect(result.caption).toBe('Front · Back');
    });
  });

  describe('updateCard', () => {
    it('creates an updated copy, persists it, and leaves the input unchanged', () => {
      const card = milestoneCard();

      const result = updateCard(card, { title: 'Updated launch' });

      expect(result).toEqual({ ...card, title: 'Updated launch' });
      expect(result).not.toBe(card);
      expect(card.title).toBe('Launch');
      expect(cardRepo.updateStoredCard).toHaveBeenCalledWith(
        card.projectId,
        card.id,
        result,
      );
    });

    it('logs repository errors but still returns the locally updated card', () => {
      const card = milestoneCard();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.mocked(cardRepo.updateStoredCard).mockImplementation(() => {
        throw new Error('Card not found');
      });

      const result = updateCard(card, { title: 'Local update' });

      expect(result.title).toBe('Local update');
      expect(consoleError).toHaveBeenCalledWith('Card not found');
    });
  });

  describe('deleteCard', () => {
    it('deletes the card from the repository', () => {
      const card = metricCard();

      deleteCard(card);

      expect(cardRepo.deleteStoredCard).toHaveBeenCalledWith(
        card.projectId,
        card.id,
      );
    });

    it('logs repository errors instead of throwing them', () => {
      const card = metricCard();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.mocked(cardRepo.deleteStoredCard).mockImplementation(() => {
        throw new Error('Project not found');
      });

      expect(() => deleteCard(card)).not.toThrow();
      expect(consoleError).toHaveBeenCalledWith('Project not found');
    });
  });
});
