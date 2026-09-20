import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { fileToImageUrl } from '../../utils';
import { createCard } from '../../cards/cardService';
import type { CardPayload, SnippetCard } from '../../types';
import { parseAutomaticInput } from '../parser';

vi.mock('../../utils', () => ({
  fileToImageUrl: vi.fn(),
}));

vi.mock('../../cards/cardService', () => ({
  createCard: vi.fn((payload: CardPayload) => ({
    id: `mock-${payload.type}`,
    ...payload,
  })),
}));

vi.mock('xlsx', () => ({
  read: vi.fn(),
  utils: {
    sheet_to_json: vi.fn(),
  },
}));

const mockCreateCard = vi.mocked(createCard);
const mockFileToImageUrl = vi.mocked(fileToImageUrl);
const mockXlsxRead = vi.mocked(XLSX.read);
const mockSheetToJson = vi.mocked(XLSX.utils.sheet_to_json);

function fakeFile(
  name: string,
  type: string,
  options: { text?: string; buffer?: ArrayBuffer } = {},
): File {
  return {
    name,
    type,
    text: vi.fn().mockResolvedValue(options.text ?? ''),
    arrayBuffer: vi.fn().mockResolvedValue(options.buffer ?? new ArrayBuffer(8)),
  } as unknown as File;
}


describe('parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCreateCard.mockImplementation((payload: CardPayload) =>
      ({
        id: `mock-${payload.type}`,
        ...payload,
      }) as SnippetCard,
    );
  });

  describe('raw text parsing', () => {
    it('returns no cards for empty/whitespace-only input', async () => {
      const result = await parseAutomaticInput({
        projectId: 'project-1',
        rawText: '   \n  ',
        files: [],
      });
      
      expect(result).toEqual([]);
      expect(createCard).not.toHaveBeenCalled();
    });

    it('parses a title:value numeric segment as a metric', async () => {
      const result = await parseAutomaticInput({
        projectId: 'project-1',
        rawText: 'API latency: 280 ms.',
        files: [],
      });

      expect(createCard).toHaveBeenCalledWith({
        type: 'metric',
        projectId: 'project-1',
        source: 'auto',
        title: 'API latency',
        value: '280 ms',
      });
      expect(result).toHaveLength(1);
    });

    it('recognizes completed, planned, and default in-progress milestones', async () => {
      await parseAutomaticInput({
        projectId: 'project-1',
        rawText:
          'Backend deployed; Frontend scheduled; API migration is in progress',
        files: [],
      });

      expect(mockCreateCard).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ type: 'milestone', status: 'completed' }),
      );
      expect(mockCreateCard).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ type: 'milestone', status: 'planned' }),
      );
      expect(mockCreateCard).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ type: 'milestone', status: 'in-progress' }),
      );
    });

    it('defaults generic project text to a milestone', async () => {
      await parseAutomaticInput({
        projectId: 'project-1',
        rawText: 'Discuss architecture with the partner team.',
        files: [],
      });

      expect(createCard).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'milestone',
          status: 'in-progress',
          description: 'Discuss architecture with the partner team',
        }),
      );
    });

    it('merges risk continuation fragments and extracts risk fields', async () => {
      await parseAutomaticInput({
        projectId: 'project-1',
        rawText:
          'Risk: Security approval delay; probability: high; impact: low; mitigation: complete review early.',
        files: [],
      });

      expect(createCard).toHaveBeenCalledTimes(1);
      expect(createCard).toHaveBeenCalledWith({
        type: 'risk',
        projectId: 'project-1',
        source: 'auto',
        title: 'Security approval delay',
        description: 'Security approval delay',
        probability: 'high',
        impact: 'low',
        mitigation: 'complete review early',
      });
    });

    it('uses medium as the default risk level when fields are absent or unknown', async () => {
      await parseAutomaticInput({
        projectId: 'project-1',
        rawText: 'Risk: Vendor may delay delivery.',
        files: [],
      });

      expect(createCard).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'risk',
          probability: 'medium',
          impact: 'medium',
        }),
      );
    });

    it('classifies risk before metric when a risk segment contains numbers', async () => {
      await parseAutomaticInput({
        projectId: 'project-1',
        rawText: 'Risk: outage probability: high impact: medium 20%',
        files: [],
      });

      expect(createCard).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'risk' }),
      );
    });
  });

  describe('image files', () => {
    it('converts an image file into an image card', async () => {
      const image = fakeFile('diagram.png', 'image/png');
      mockFileToImageUrl.mockReturnValue('blob:diagram');

      const result = await parseAutomaticInput({
        projectId: 'project-1',
        rawText: '',
        files: [image],
      });

      expect(fileToImageUrl).toHaveBeenCalledWith(image);
      expect(createCard).toHaveBeenCalledWith({
        type: 'image',
        projectId: 'project-1',
        source: 'auto',
        imageUrl: 'blob:diagram',
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('CSV parsing', () => {
    it('reads CSV as text and classifies rows using the filename', async () => {
      const file = fakeFile('project-metrics.csv', 'text/csv', {
        text: 'Name,Value\nLatency,280 ms',
      });
      const sheet = { A1: {} };

      mockXlsxRead.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: sheet },
      } as XLSX.WorkBook);
      mockSheetToJson.mockReturnValue([
        { Name: 'Latency', Value: '280 ms' },
        { Name: 'Errors', Value: 12 },
      ]);

      const result = await parseAutomaticInput({
        projectId: 'project-1',
        rawText: '',
        files: [file],
      });

      expect(file.text).toHaveBeenCalled();
      expect(XLSX.read).toHaveBeenCalledWith('Name,Value\nLatency,280 ms', {
        type: 'string',
      });
      expect(XLSX.utils.sheet_to_json).toHaveBeenCalledWith(sheet, {
        defval: '',
      });
      expect(mockCreateCard).toHaveBeenNthCalledWith(1, {
        type: 'metric',
        projectId: 'project-1',
        source: 'auto',
        title: 'Latency',
        value: '280 ms',
      });
      expect(mockCreateCard).toHaveBeenNthCalledWith(2, {
        type: 'metric',
        projectId: 'project-1',
        source: 'auto',
        title: 'Errors',
        value: '12',
      });
      expect(result).toHaveLength(2);
    });

    it('returns no cards when a CSV workbook has no sheets', async () => {
      const file = fakeFile('metrics.csv', 'text/csv');
      mockXlsxRead.mockReturnValue({
        SheetNames: [],
        Sheets: {},
      } as XLSX.WorkBook);

      const result = await parseAutomaticInput({
        projectId: 'project-1',
        rawText: '',
        files: [file],
      });

      expect(result).toEqual([]);
      expect(createCard).not.toHaveBeenCalled();
    });

    it('returns no cards when the first CSV sheet is missing', async () => {
      const file = fakeFile('metrics.csv', 'text/csv');
      mockXlsxRead.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: {},
      } as XLSX.WorkBook);

      const result = await parseAutomaticInput({
        projectId: 'project-1',
        rawText: '',
        files: [file],
      });

      expect(result).toEqual([]);
    });
  });

  describe('Excel parsing and structured classification', () => {
    it('reads Excel as an array and uses each sheet name as classification context', async () => {
      const file = fakeFile('report.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const risksSheet = { A1: {} };
      const timelineSheet = { A1: {} };
      const metricsSheet = { A1: {} };

      mockXlsxRead.mockReturnValue({
        SheetNames: ['Risks', 'Timeline', 'KPIs'],
        Sheets: {
          Risks: risksSheet,
          Timeline: timelineSheet,
          KPIs: metricsSheet,
        },
      } as XLSX.WorkBook);
      mockSheetToJson
        .mockReturnValueOnce([
          {
            ' Risk ': 'Supplier delay',
            Probability: 'HIGH',
            Severity: 'low',
            Mitigation: 'Order early',
          },
        ])
        .mockReturnValueOnce([
          {
            NAME: 'Beta launch',
            Details: 'Release beta',
            Status: 'Done',
            Deadline: '2026-10-01',
          },
        ])
        .mockReturnValueOnce([{ Metric: 'Conversion', Result: '42%' }]);

      const result = await parseAutomaticInput({
        projectId: 'project-1',
        rawText: '',
        files: [file],
      });

      expect(file.arrayBuffer).toHaveBeenCalled();
      expect(XLSX.read).toHaveBeenCalledWith(expect.any(ArrayBuffer), {
        type: 'array',
      });
      expect(mockCreateCard).toHaveBeenNthCalledWith(1, {
        type: 'risk',
        projectId: 'project-1',
        source: 'auto',
        title: 'Supplier delay',
        description: 'Supplier delay',
        probability: 'high',
        impact: 'low',
        mitigation: 'Order early',
      });
      expect(mockCreateCard).toHaveBeenNthCalledWith(2, {
        type: 'milestone',
        projectId: 'project-1',
        source: 'auto',
        title: 'Beta launch',
        description: 'Release beta',
        status: 'completed',
        date: '2026-10-01',
      });
      expect(mockCreateCard).toHaveBeenNthCalledWith(3, {
        type: 'metric',
        projectId: 'project-1',
        source: 'auto',
        title: 'Conversion',
        value: '42%',
      });
      expect(result).toHaveLength(3);
    });

    it('classifies structured rows by normalized column names when context is neutral', async () => {
      const file = fakeFile('data.xls', 'application/vnd.ms-excel');
      const sheet = { A1: {} };

      mockXlsxRead.mockReturnValue({
        SheetNames: ['Data'],
        Sheets: { Data: sheet },
      } as XLSX.WorkBook);
      mockSheetToJson.mockReturnValue([
        {
          ' Risk-Name ': 'Capacity',
          'LIKELIHOOD': 'low',
          IMPACT: 'HIGH',
          Response: 'Scale early',
        },
      ]);

      await parseAutomaticInput({
        projectId: 'project-1',
        rawText: '',
        files: [file],
      });

      expect(createCard).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'risk',
          probability: 'low',
          impact: 'high',
          mitigation: 'Scale early',
        }),
      );
    });

    it('uses classification priority risk > milestone > metric for ambiguous rows', async () => {
      const file = fakeFile('data.xlsx', 'application/octet-stream');
      const sheet = { A1: {} };

      mockXlsxRead.mockReturnValue({
        SheetNames: ['Data'],
        Sheets: { Data: sheet },
      } as XLSX.WorkBook);
      mockSheetToJson.mockReturnValue([
        {
          Name: 'Ambiguous row',
          Probability: 'high',
          Status: 'done',
          Value: '50',
        },
      ]);

      await parseAutomaticInput({
        projectId: 'project-1',
        rawText: '',
        files: [file],
      });

      expect(createCard).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'risk' }),
      );
    });

    it('uses default structured values when title/value/status/risk levels are missing', async () => {
      const file = fakeFile('metrics.xlsx', 'application/octet-stream');
      const sheet = { A1: {} };

      mockXlsxRead.mockReturnValue({
        SheetNames: ['Metrics'],
        Sheets: { Metrics: sheet },
      } as XLSX.WorkBook);
      mockSheetToJson.mockReturnValue([{ Other: 'nothing useful' }]);

      await parseAutomaticInput({
        projectId: 'project-1',
        rawText: '',
        files: [file],
      });

      expect(createCard).toHaveBeenCalledWith({
        type: 'metric',
        projectId: 'project-1',
        source: 'auto',
        title: 'New card',
        value: '—',
      });
    });

    it('skips unclassifiable structured rows and warns', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const file = fakeFile('data.xlsx', 'application/octet-stream');
      const sheet = { A1: {} };

      mockXlsxRead.mockReturnValue({
        SheetNames: ['Data'],
        Sheets: { Data: sheet },
      } as XLSX.WorkBook);
      mockSheetToJson.mockReturnValue([{ Name: 'Unknown', Comment: 'Hello' }]);

      const result = await parseAutomaticInput({
        projectId: 'project-1',
        rawText: '',
        files: [file],
      });

      expect(result).toEqual([]);
      expect(createCard).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        'Could not classify structured row in "Data":',
        { name: 'Unknown', comment: 'Hello' },
      );

      warn.mockRestore();
    });

    it('skips missing Excel sheets', async () => {
      const file = fakeFile('data.xlsx', 'application/octet-stream');

      mockXlsxRead.mockReturnValue({
        SheetNames: ['Missing'],
        Sheets: {},
      } as XLSX.WorkBook);

      const result = await parseAutomaticInput({
        projectId: 'project-1',
        rawText: '',
        files: [file],
      });

      expect(result).toEqual([]);
      expect(XLSX.utils.sheet_to_json).not.toHaveBeenCalled();
    });
  });

  describe('file routing', () => {
    it('matches file extensions case-insensitively', async () => {
      const file = fakeFile('METRICS.CSV', 'application/octet-stream', {
        text: 'Name,Value\nUsers,42',
      });
      const sheet = { A1: {} };

      mockXlsxRead.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: sheet },
      } as XLSX.WorkBook);
      mockSheetToJson.mockReturnValue([{ Name: 'Users', Value: '42' }]);

      await parseAutomaticInput({
        projectId: 'project-1',
        rawText: '',
        files: [file],
      });

      expect(file.text).toHaveBeenCalled();
      expect(createCard).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'metric' }),
      );
    });

    it('ignores unsupported files and logs a warning', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const file = fakeFile('notes.pdf', 'application/pdf');

      const result = await parseAutomaticInput({
        projectId: 'project-1',
        rawText: '',
        files: [file],
      });

      expect(result).toEqual([]);
      expect(warn).toHaveBeenCalledWith('Unsupported file type: notes.pdf');
      expect(createCard).not.toHaveBeenCalled();

      warn.mockRestore();
    });

    it('combines raw-text cards and uploaded-file cards in input order', async () => {
      const image = fakeFile('diagram.jpg', 'image/jpeg');
      mockFileToImageUrl.mockReturnValue('blob:diagram');

      const result = await parseAutomaticInput({
        projectId: 'project-1',
        rawText: 'Completion: 87%.',
        files: [image],
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ type: 'metric' });
      expect(result[1]).toMatchObject({ type: 'image' });
      expect(mockCreateCard.mock.calls[0][0]).toMatchObject({ type: 'metric' });
      expect(mockCreateCard.mock.calls[1][0]).toMatchObject({ type: 'image' });
    });
  });
});
