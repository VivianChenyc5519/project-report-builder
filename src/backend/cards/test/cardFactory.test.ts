import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardPayload } from '../../types';
import { createCardObject, createMetricEntry } from '../cardFactory';

describe('cardFactory', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createCardObject', () => {
    it('creates a metric card with one initial metric entry', () => {
      const payload = {
        type: 'metric',
        projectId: 'project-1',
        title: 'Revenue',
        value: '€12k',
        source: 'manual',
      } as CardPayload;

      const card = createCardObject(payload);

      expect(card).toMatchObject({
        projectId: 'project-1',
        type: 'metric',
        title: 'Revenue',
        source: 'manual',
        entries: [
          expect.objectContaining({
            title: 'Revenue',
            value: '€12k',
          }),
        ],
      });
      expect(card.id).toMatch(/^metric-/);
      expect(card.type === 'metric' && card.entries[0].id).toMatch(/^metric-entry-/);
    });

    it('creates a milestone card and applies the default status and description', () => {
      const payload = {
        type: 'milestone',
        projectId: 'project-1',
        title: 'Beta release',
        date: '2026-10-01',
        source: 'manual',
      } as CardPayload;

      const card = createCardObject(payload);

      expect(card).toMatchObject({
        projectId: 'project-1',
        type: 'milestone',
        title: 'Beta release',
        description: '',
        status: 'in-progress',
        date: '2026-10-01',
        source: 'manual',
      });
      expect(card.id).toMatch(/^milestone-/);
    });

    it('keeps explicitly supplied milestone values', () => {
      const payload = {
        type: 'milestone',
        projectId: 'project-1',
        title: 'Launch',
        description: 'Public launch',
        status: 'completed',
        date: '2026-11-01',
        source: 'manual',
      } as CardPayload;

      const card = createCardObject(payload);

      expect(card).toMatchObject({
        type: 'milestone',
        description: 'Public launch',
        status: 'completed',
      });
    });

    it('creates a risk card and applies defaults', () => {
      const payload = {
        type: 'risk',
        projectId: 'project-1',
        title: 'API outage',
        source: 'manual',
      } as CardPayload;

      const card = createCardObject(payload);

      expect(card).toMatchObject({
        projectId: 'project-1',
        type: 'risk',
        title: 'API outage',
        description: '',
        probability: 'medium',
        impact: 'medium',
        mitigation: '',
        source: 'manual',
      });
      expect(card.id).toMatch(/^risk-/);
    });

    it('creates an image card with empty editable metadata', () => {
      const payload = {
        type: 'image',
        projectId: 'project-1',
        imageUrl: 'https://example.com/image.png',
        source: 'manual',
      } as CardPayload;

      const card = createCardObject(payload);

      expect(card).toMatchObject({
        projectId: 'project-1',
        type: 'image',
        title: '',
        imageUrl: 'https://example.com/image.png',
        caption: '',
        altText: '',
        source: 'manual',
      });
      expect(card.id).toMatch(/^image-/);
    });
  });

  describe('createMetricEntry', () => {
    it('uses default values when no arguments are provided', () => {
      const entry = createMetricEntry();

      expect(entry).toMatchObject({
        title: 'New Metric',
        value: '0',
      });
      expect(entry.id).toMatch(/^metric-entry-/);
    });

    it('uses supplied title and value', () => {
      const entry = createMetricEntry('Users', '42');

      expect(entry).toMatchObject({
        title: 'Users',
        value: '42',
      });
    });
  });
});
