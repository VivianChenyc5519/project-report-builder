import type { Project } from './cards/types';

export const initialProjects: Project[] = [
  {
    id: 'project-1',
    name: 'Project 1',
    cards: [
      {
        id: 'metric-1',
        source: 'manual',
        projectId: '1',
        type: 'metric',
        title: 'Card Title',
        entries: [
          { id: 'm1', title: 'API latency', value: '12%' },
          { id: 'm2', title: 'Some other metric', value: '87%' }
        ],  
      },
      {
        id: 'milestone-1',
        source: 'manual',
        projectId: '1',
        type: 'milestone',
        title: 'Card Title',
        description: 'A milestone update for the project.',
        status: 'in-progress'
      },
      {
        source: 'manual',
        projectId: '1',
        id: 'image-1',
        type: 'image',
        title: 'Card title',
        imageUrl: '',
        caption: 'Image asset placeholder',
        altText: 'Project image placeholder'
      }
    ]
  },
  {
    id: 'project-2',
    name: 'Project 2',
    cards: [
      {
        source: 'manual',
        projectId: '2',
        id: 'milestone-2',
        type: 'milestone',
        title: 'API migration',
        description: 'API migration milestone.',
        status: 'completed'
      },
      {
        id: 'image-2',
        source: 'manual',
        projectId: '2',
        type: 'image',
        title: 'API use frequency',
        imageUrl: '',
        caption: 'Image asset placeholder',
        altText: 'API use frequency image placeholder'
      }
    ]
  }
];
