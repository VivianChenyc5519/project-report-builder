import { initialProjects } from '../database';
import type { Project, SnippetCard } from '../types';

let database: Project[] = structuredClone(initialProjects);

export function getProjects(): Project[] {
  return database;
}

export function getProjectById(
  projectId: string
): Project | undefined {
  return database.find(
    (project) => project.id === projectId
  );
}

export function saveCard(
  card: SnippetCard
): void {
  const project = database.find(
    (project) => project.id === card.projectId
  );

  if (!project) {
    throw new Error('Project not found');
  }

  project.cards.push(card);
}

export function updateStoredCard(
  projectId: string,
  cardId: string,
  nextCard: SnippetCard
): void {
  const project = database.find(
    (project) => project.id === projectId
  );

  if (!project) {
    throw new Error('Project not found');
  }

  const index = project.cards.findIndex(
    (card) => card.id === cardId
  );

  if (index === -1) {
    throw new Error('Card not found');
  }

  project.cards[index] = nextCard;
}

export function deleteStoredCard(
  projectId: string,
  cardId: string
): void {
  const project = database.find(
    (project) => project.id === projectId
  );

  if (!project) {
    throw new Error('Project not found');
  }
  const cardExists = project.cards.some(
    (card) => card.id === cardId
  );

  if (!cardExists) {
    throw new Error('Card not found');
  }

  project.cards = project.cards.filter(
    (card) => card.id !== cardId
  );
}
