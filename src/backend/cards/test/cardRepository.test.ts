import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project, SnippetCard } from "../../types";

const initialProjects: Project[] = [
  {
    id: "project-1",
    name: "Project One",
    cards: [],
  } as Project,
  {
    id: "project-2",
    name: "Project Two",
    cards: [],
  } as Project,
];

vi.mock('../../database', () => ({
  initialProjects: initialProjects
}));

const makeMetricCard = (overrides: Partial<SnippetCard> = {}): SnippetCard =>
  ({
    id: "card-1",
    projectId: "project-1",
    type: "metric",
    title: "Revenue",
    source: "manual",
    entries: [{ id: "entry-1", title: "Revenue", value: "100" }],
    ...overrides,
  }) as SnippetCard;

describe("cardRepository", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns all projects from its internal database", async () => {
    const repo = await import("../cardRepository");

    const projects = repo.getProjects();

    expect(projects).toHaveLength(2);
    expect(projects.map((project) => project.id)).toEqual([
      "project-1",
      "project-2",
    ]);
  });

  it("returns a project by id and undefined for an unknown id", async () => {
    const repo = await import("../cardRepository");

    expect(repo.getProjectById("project-1")?.id).toBe("project-1");
    expect(repo.getProjectById("missing")).toBeUndefined();
  });

  it("saves a card in the matching project", async () => {
    const repo = await import("../cardRepository");
    const card = makeMetricCard();

    repo.saveCard(card);

    expect(repo.getProjectById("project-1")?.cards).toContainEqual(card);
  });

  it("throws when saving a card for an unknown project", async () => {
    const repo = await import("../cardRepository");
    const card = makeMetricCard({ projectId: "missing-project" });

    expect(() => repo.saveCard(card)).toThrow("Project not found");
  });

  it("updates an existing stored card", async () => {
    const repo = await import("../cardRepository");
    const original = makeMetricCard();
    const replacement = makeMetricCard({ title: "Updated revenue" });

    repo.saveCard(original);
    repo.updateStoredCard("project-1", "card-1", replacement);
    const updatedCard = repo
      .getProjectById("project-1")
      ?.cards.find((card) => card.id === "card-1");

    expect(updatedCard).toEqual(replacement);
  });

  it("throws when updating a card in an unknown project", async () => {
    const repo = await import("../cardRepository");

    expect(() =>
      repo.updateStoredCard("missing-project", "card-1", makeMetricCard()),
    ).toThrow("Project not found");
  });

  it("throws when the card to update does not exist", async () => {
    const repo = await import("../cardRepository");

    expect(() =>
      repo.updateStoredCard("project-1", "missing-card", makeMetricCard()),
    ).toThrow("Card not found");
  });

  it("deletes a stored card", async () => {
    const repo = await import("../cardRepository");

    const card1 = makeMetricCard({ id: "card-1" });
    const card2 = makeMetricCard({ id: "card-2" });

    repo.saveCard(card1);
    repo.saveCard(card2);

    repo.deleteStoredCard("project-1", "card-1");

    const project = repo.getProjectById("project-1");

    expect(project?.cards.find((card) => card.id === "card-1")).toBeUndefined();

    expect(project?.cards.find((card) => card.id === "card-2")).toEqual(card2);
  });

  it("throws when deleting an unknown card from an existing project", async () => {
    const repo = await import("../cardRepository");

    expect(() =>
      repo.deleteStoredCard("project-1", "missing-card"),
    ).toThrow("Card not found");
    expect(repo.getProjectById("project-1")?.cards).toEqual([]);
  });

  it("throws when deleting from an unknown project", async () => {
    const repo = await import("../cardRepository");

    expect(() => repo.deleteStoredCard("missing-project", "card-1")).toThrow(
      "Project not found",
    );
  });

  it("starts from a structured clone rather than mutating initialProjects", async () => {
    const repo = await import("../cardRepository");

    repo.saveCard(makeMetricCard());

    expect(initialProjects[0].cards).toEqual([]);
  });
});
