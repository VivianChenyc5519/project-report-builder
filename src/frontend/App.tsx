import { useEffect, useMemo, useRef, useState } from "react";
import { initialProjects } from "../backend/database";
import type {
  CardType,
  ImageCard,
  MetricCard,
  MilestoneCard,
  RiskCard,
  Project,
  SnippetCard,
  CardStatus,
  RiskLevel,
} from "../backend/types";
import { parseAutomaticInput } from "../backend/parser/parser";
import {
  createCard,
  mergeCards,
  addMetricCardEntry,
  removeMetricEntry,
  updateMetricEntry,
  updateCard,
} from "../backend/cards/cardService";
import { fileToImageUrl } from "../backend/utils";

// const uid = (prefix: string) =>
//   `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

const cardColorClass: Record<CardType, string> = {
  metric: "card--metric",
  milestone: "card--milestone",
  image: "card--image",
  risk: "card--risk",
};

const typeLabel: Record<CardType, string> = {
  metric: "Metric",
  milestone: "Milestone",
  image: "Image",
  risk: "Risk",
};

export default function App() {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [autoModalOpen, setAutoModalOpen] = useState(false);
  const [detail, setDetail] = useState<{
    projectId: string;
    cardId: string;
  } | null>(null);
  const [editing, setEditing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [internalClipboard, setInternalClipboard] =
    useState<SnippetCard | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );

  const detailCard = useMemo(() => {
    if (!detail) return null;
    const project = projects.find((item) => item.id === detail.projectId);
    return project?.cards.find((card) => card.id === detail.cardId) ?? null;
  }, [projects, detail]);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  };

  const openAddMenu = () => setMenuOpen((value) => !value);

  const openDetail = (projectId: string, cardId: string) => {
    setDetail({ projectId, cardId });
    setEditing(false);
    setShareOpen(false);
  };

  const updateCard = (
    projectId: string,
    cardId: string,
    nextCard: SnippetCard,
  ) => {
    setProjects((current) =>
      current.map((project) =>
        project.id === projectId
          ? {
              ...project,
              cards: project.cards.map((card) =>
                card.id === cardId ? nextCard : card,
              ),
            }
          : project,
      ),
    );
  };

  const removeCard = (projectId: string, cardId: string) => {
    setProjects((current) =>
      current.map((project) =>
        project.id === projectId
          ? {
              ...project,
              cards: project.cards.filter((card) => card.id !== cardId),
            }
          : project,
      ),
    );
  };

  const addCard = (projectId: string, card: SnippetCard) => {
    setProjects((current) =>
      current.map((project) =>
        project.id === projectId
          ? { ...project, cards: [card, ...project.cards] }
          : project,
      ),
    );
  };

  const mergedCards = (
    target: SnippetCard,
    copied: SnippetCard,
  ): SnippetCard => {
    // Copy of different type or copy of cards in different projects are not allowed
    
    if (target.type !== copied.type) return target;
    if (target.projectId !== copied.projectId) return target;
    const merged = mergeCards(target, copied);

    setProjects((current) =>
      current.map((project) =>
        project.id === target.projectId
          ? {
              ...project,
              cards: project.cards.map((card) =>
                card.id === target.id ? merged : card,
              ),
            }
          : project,
      ),
    );

    return merged;
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier || !detailCard || !detail) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select")) return;

      if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        setInternalClipboard(structuredClone(detailCard));
        flash("Card copied inside Project Builder");
      }
      console.log(internalClipboard, detailCard);
      if (event.key.toLowerCase() === "v" && internalClipboard) {
        event.preventDefault();
        if (internalClipboard.type !== detailCard.type) {
          flash("Only cards of the same type can be merged");
          return;
        } else if (internalClipboard.projectId !== detailCard.projectId) {
          flash("Data from different projects are not mergable");
          return;
        }
        updateCard(
          detail.projectId,
          detail.cardId,
          mergedCards(detailCard, internalClipboard),
        );
        flash("Copied card merged");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailCard, detail, internalClipboard]);

  const visibleProjects = activeProject ? [activeProject] : projects;

  return (
    <div className="app-shell">
      <header className="top-bar">
        {activeProject ? (
          <button
            className="back-button"
            onClick={() => setActiveProjectId(null)}
            aria-label="Back to all projects"
          >
            <span aria-hidden="true">←</span>
          </button>
        ) : (
          <span />
        )}
        <div className="avatar" aria-label="User profile placeholder">
          U
        </div>
      </header>

      <main className="workspace">
        {visibleProjects.map((project) => (
          <section className="project-section" key={project.id}>
            <div className="project-heading">
              <span className="project-pill">{project.name}</span>
            </div>

            <div className="project-content-row">
              <div
                className={`cards-row ${activeProject ? "cards-row--all" : ""}`}
              >
                {(activeProject
                  ? project.cards
                  : project.cards.slice(0, 3)
                ).map((card) => (
                  <div className="card-wrap" key={card.id}>
                    <SnippetCardTile
                      card={card}
                      onView={() => openDetail(project.id, card.id)}
                    />
                  </div>
                ))}
              </div>
              {!activeProject && (
                <button
                  className="project-arrow"
                  aria-label={`Open ${project.name}`}
                  onClick={() => setActiveProjectId(project.id)}
                >
                  <span className="arrow-line" />
                </button>
              )}
            </div>

            {activeProject && (
              <div className="project-page-actions">
                <AddButton onClick={openAddMenu} />
              </div>
            )}
          </section>
        ))}

        {!activeProject && (
          <div className="global-add-area">
            <AddButton onClick={openAddMenu} />
          </div>
        )}

        {menuOpen && (
          <AddMenu
            onClose={() => setMenuOpen(false)}
            onManual={() => {
              setMenuOpen(false);
              setAddModalOpen(true);
            }}
            onAuto={() => {
              setMenuOpen(false);
              setAutoModalOpen(true);
            }}
          />
        )}
      </main>

      {addModalOpen && (
        <AddCardModal
          projects={projects}
          defaultProjectId={activeProjectId ?? projects[0]?.id ?? ""}
          onClose={() => setAddModalOpen(false)}
          onCreate={(projectId, card) => {
            addCard(projectId, { ...card } as SnippetCard);
            setAddModalOpen(false);
            flash("Card added");
          }}
        />
      )}

      {autoModalOpen && (
        <AutoIngestModal
          projects={projects}
          defaultProjectId={activeProjectId ?? projects[0]?.id ?? ""}
          onClose={() => setAutoModalOpen(false)}
          onSubmit={(projectId, cards) => {
            cards.forEach((card) => addCard(projectId, card));
            setAutoModalOpen(false);
            flash(
              `${cards.length} card${cards.length === 1 ? "" : "s"} generated`,
            );
          }}
        />
      )}

      {detail && detailCard && (
        <DetailModal
          card={detailCard}
          editing={editing}
          shareOpen={shareOpen}
          onClose={() => {
            setDetail(null);
            setEditing(false);
            setShareOpen(false);
          }}
          onEdit={() => setEditing((value) => !value)}
          onShare={() => setShareOpen((value) => !value)}
          onChange={(card) => updateCard(detail.projectId, detail.cardId, card)}
          onMockShare={(channel) =>
            flash(
              `${channel} sharing will connect to communication tools later`,
            )
          }
          onExternalCopy={() =>
            flash("Mock export copied for external sharing")
          }
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="add-button" onClick={onClick} aria-label="Add new card">
      +
    </button>
  );
}

function AddMenu({
  onClose,
  onManual,
  onAuto,
}: {
  onClose: () => void;
  onManual: () => void;
  onAuto: () => void;
}) {
  return (
    <div className="modal-backdrop soft" onMouseDown={onClose}>
      <div
        className="add-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Add snippet card"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="modal-close detail-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <button onClick={onAuto} className="slide-fill-button" role="menuitem">
          <span>＋</span> Add automatically
        </button>
        <button
          onClick={onManual}
          className="slide-fill-button"
          role="menuitem"
        >
          <span>▣</span> Input manually
        </button>
      </div>
    </div>
  );
}

function SnippetCardTile({
  card,
  onView,
}: {
  card: SnippetCard;
  onView: () => void;
}) {
  return (
    <article className={`snippet-card ${cardColorClass[card.type]}`}>
      <div className="card-content">
        <p className="card-type">{typeLabel[card.type]}</p>
        <h2>{card.title}</h2>
      </div>
      <div className="card-hover-panel">
        <button onClick={onView}>View Details</button>
      </div>
    </article>
  );
}

function AutoIngestModal({
  projects,
  defaultProjectId,
  onClose,
  onSubmit,
}: {
  projects: Project[];
  defaultProjectId: string;
  onClose: () => void;
  onSubmit: (projectId: string, cards: SnippetCard[]) => void;
}) {
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [rawText, setRawText] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    setFiles((current) => [...current, ...Array.from(selectedFiles)]);
  };

  const removeFile = (index: number) => {
    setFiles((current) =>
      current.filter((_, fileIndex) => fileIndex !== index),
    );
  };

  const handleDone = async () => {
    if (!rawText.trim() && files.length === 0) {
      return;
    }

    const cards = await parseAutomaticInput({
      projectId,
      rawText,
      files,
    });

    onSubmit(projectId, cards);
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="entry-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add cards automatically"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="project-heading">
          <p className="eyebrow">Project name</p>

          <button
            type="button"
            className="add-project-button"
            aria-label="Add project"
          >
            +
          </button>
        </div>

        <div className="segmented-wrap">
          {projects.map((project) => (
            <button
              key={project.id}
              className={`project-choice ${
                projectId === project.id ? "active" : ""
              }`}
              onClick={() => setProjectId(project.id)}
            >
              {project.name}
            </button>
          ))}
        </div>

        <div className="auto-upload-row">
          <button
            type="button"
            className="auto-upload-trigger"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach files"
          >
            +
          </button>

          <textarea
            className="auto-textarea"
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            placeholder="Paste text, metrics, notes, or project updates..."
          />
        </div>

        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          multiple
          accept=".csv,.xlsx,image/png,image/jpeg"
          onChange={(event) => handleFiles(event.target.files)}
        />

        <div className="modal-footer">
          <button className="done-button" onClick={handleDone}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function AddCardModal({
  projects,
  defaultProjectId,
  onClose,
  onCreate,
}: {
  projects: Project[];
  defaultProjectId: string;
  onClose: () => void;
  onCreate: (projectId: string, card: SnippetCard) => void;
}) {
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [type, setType] = useState<CardType>("metric");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<CardStatus>("planned");
  const [date, setDate] = useState("");
  const [caption, setCaption] = useState("");
  const [altText, setAltText] = useState("");
  const [probability, setProbability] = useState<RiskLevel>("medium");
  const [impact, setImpact] = useState<RiskLevel>("medium");
  const [mitigation, setMitigation] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const submit = () => {
    if (!title.trim()) return;
    if (type === "metric") {
      const card: SnippetCard = createCard({
        type: "metric",
        projectId: projectId,
        source: "manual",
        title: title,
        value: value,
      });
      onCreate(projectId, card);
      return;
    }
    if (type === "milestone") {
      const card: SnippetCard = createCard({
        type: "milestone",
        projectId: projectId,
        source: "manual",
        title: title,
        description: description,
        status: status,
        date: date,
      });
      onCreate(projectId, card);
      return;
    }
    if (type === "risk") {
      const card: SnippetCard = createCard({
        type: "risk",
        projectId: projectId,
        source: "manual",
        title: title,
        description: description,
        probability: probability,
        impact: impact,
        mitigation: mitigation,
      });
      onCreate(projectId, card);
      return;
    }
    if (!imageFile) {
      console.warn("No image file selected");
      return;
    }
    const card: SnippetCard = createCard({
      type: "image",
      projectId: projectId,
      source: "manual",
      imageUrl: fileToImageUrl(imageFile),
    });
    onCreate(projectId, card);
    return;
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="entry-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add card manually"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="project-heading">
          <p className="eyebrow">Project name</p>

          <button
            type="button"
            className="add-project-button"
            aria-label="Add project"
          >
            +
          </button>
        </div>

        <div className="segmented-wrap">
          {projects.map((project) => (
            <button
              key={project.id}
              className={`project-choice ${projectId === project.id ? "active" : ""}`}
              onClick={() => setProjectId(project.id)}
            >
              {project.name}
            </button>
          ))}
        </div>

        <p className="eyebrow">Card type</p>
        <div className="segmented-wrap card-types">
          {(["metric", "milestone", "image", "risk"] as CardType[]).map(
            (item) => (
              <button
                key={item}
                className={type === item ? "active" : ""}
                onClick={() => setType(item)}
              >
                {typeLabel[item]}
              </button>
            ),
          )}
        </div>

        <label className="field-label">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        {type === "metric" && (
          <label className="field-label">
            Value
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="e.g. 87%, 280 ms, $4.2M"
            />
          </label>
        )}

        {type === "milestone" && (
          <>
            <label className="field-label">
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
              />
            </label>
            <div className="two-col-fields">
              <label className="field-label">
                Status
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as MilestoneCard["status"])
                  }
                >
                  <option value="planned">Planned</option>
                  <option value="in-progress">In progress</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
              <label className="field-label">
                Date
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </label>
            </div>
          </>
        )}

        {type === "risk" && (
          <>
            <label className="field-label">
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
              />
            </label>

            <label className="field-label">
              Probability
              <select
                onChange={(event) =>
                  setProbability(event.target.value as RiskCard["probability"])
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>

            <label className="field-label">
              Impact
              <select
                onChange={(event) =>
                  setImpact(event.target.value as RiskCard["impact"])
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>

            <label className="field-label">
              Mitigation
              <textarea
                value={mitigation}
                onChange={(event) => setMitigation(event.target.value)}
                rows={3}
              />
            </label>
          </>
        )}

        {type === "image" && (
          <>
            <div className="image-placeholder compact">
              <span>Select an image</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;

                  setImageFile(file);
                }}
              />
              {imageFile && (
                <div className="image-upload-preview">
                  <img src={fileToImageUrl(imageFile)} alt="Selected preview" />

                  <span>{imageFile.name}</span>
                </div>
              )}
            </div>
            <label className="field-label">
              Caption
              <input
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
              />
            </label>
            <label className="field-label">
              Alt text
              <input
                value={altText}
                onChange={(event) => setAltText(event.target.value)}
              />
            </label>
          </>
        )}

        <div className="modal-footer">
          <button className="done-button slide-fill-button" onClick={submit}>
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailModal({
  card,
  editing,
  shareOpen,
  onClose,
  onEdit,
  onShare,
  onChange,
  onMockShare,
  onExternalCopy,
}: {
  card: SnippetCard;
  editing: boolean;
  shareOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onShare: () => void;
  onChange: (card: SnippetCard) => void;
  onMockShare: (channel: string) => void;
  onExternalCopy: () => void;
}) {
  return (
    <div className="modal-backdrop soft" onMouseDown={onClose}>
      <div
        className="detail-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${card.title} details`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="modal-close detail-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <div className="detail-actions">
          <button onClick={onEdit} aria-label="Edit card">
            ✎
          </button>
          <button onClick={onShare} aria-label="Share card">
            ⇧
          </button>
        </div>

        {card.type === "metric" && (
          <MetricDetail card={card} editing={editing} onChange={onChange} />
        )}
        {card.type === "milestone" && (
          <MilestoneDetail card={card} editing={editing} onChange={onChange} />
        )}
        {card.type === "image" && (
          <ImageDetail card={card} editing={editing} onChange={onChange} />
        )}
        {card.type === "risk" && (
          <RiskDetail card={card} editing={editing} onChange={onChange} />
        )}

        {/* <p className="shortcut-hint">
          ⌘C copies this card internally · ⌘V merges a copied card of the same
          type
        </p> */}

        {shareOpen && (
          <div className="share-popover">
            <button onClick={() => onMockShare("Mail")}>
              <span>✉</span>
              <small>Mail</small>
            </button>
            <button onClick={() => onMockShare("WhatsApp")}>
              <span>◉</span>
              <small>WhatsApp</small>
            </button>
            <button onClick={() => onMockShare("Slack")}>
              <span>▦</span>
              <small>Slack</small>
            </button>
            <button
              className="copy-share slide-fill-button"
              onClick={onExternalCopy}
            >
              <span>⎘</span>
              <small>Copy</small>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RiskDetail({
  card,
  editing,
  onChange,
}: {
  card: RiskCard;
  editing: boolean;
  onChange: (card: SnippetCard) => void;
}) {
  if (editing) {
    return (
      <div className="detail-form risk-detail-form">
        <label className="field-label">
          Title
          <input
            value={card.title}
            onChange={(event) =>
              onChange({
                ...card,
                title: event.target.value,
              })
            }
          />
        </label>

        <label className="field-label">
          Description
          <textarea
            rows={4}
            value={card.description}
            onChange={(event) =>
              onChange({
                ...card,
                description: event.target.value,
              })
            }
          />
        </label>

        <div className="two-col-fields">
          <label className="field-label">
            Probability
            <select
              value={card.probability}
              onChange={(event) =>
                onChange({
                  ...card,
                  probability: event.target.value as RiskCard["probability"],
                })
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>

          <label className="field-label">
            Impact
            <select
              value={card.impact}
              onChange={(event) =>
                onChange({
                  ...card,
                  impact: event.target.value as RiskCard["probability"],
                })
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>

        <label className="field-label">
          Mitigation
          <textarea
            rows={3}
            value={card.mitigation ?? ""}
            onChange={(event) =>
              onChange({
                ...card,
                mitigation: event.target.value,
              })
            }
          />
        </label>
      </div>
    );
  }

  return (
    <div className="risk-detail">
      <h2>{card.title}</h2>

      <p className="risk-description">{card.description}</p>

      <div className="risk-meta">
        <div>
          <span>Probability</span>
          <strong>{card.probability}</strong>
        </div>

        <div>
          <span>Impact</span>
          <strong>{card.impact}</strong>
        </div>
      </div>

      {card.mitigation && (
        <div className="risk-mitigation">
          <span>Mitigation</span>
          <p>{card.mitigation}</p>
        </div>
      )}
    </div>
  );
}

function MetricDetail({
  card,
  editing,
  onChange,
}: {
  card: MetricCard;
  editing: boolean;
  onChange: (card: SnippetCard) => void;
}) {
  const addEntry = () => onChange(addMetricCardEntry(card));

  const removeEntry = (id: string) => onChange(removeMetricEntry(card, id));

  const updateEntry = (
    id: string,
    patch: Partial<MetricCard["entries"][number]>,
  ) => onChange(updateMetricEntry(card, id, patch));

  return (
    <div className="metric-detail">
      <div className="metric-table">
        <div className="metric-table-header">
          <span>Metric</span>
          <span>Value</span>
        </div>

        {card.entries.map((entry) => (
          <div className="metric-row" key={entry.id}>
            {editing ? (
              <>
                <input
                  className="metric-title-input"
                  value={entry.title}
                  onChange={(event) =>
                    updateEntry(entry.id, {
                      title: event.target.value,
                    })
                  }
                />

                <div className="metric-value-edit">
                  <input
                    className="metric-value-input"
                    value={entry.value}
                    onChange={(event) =>
                      updateEntry(entry.id, {
                        value: event.target.value,
                      })
                    }
                  />

                  <button
                    className="metric-remove"
                    onClick={() => removeEntry(entry.id)}
                    aria-label={`Delete ${entry.title}`}
                  >
                    −
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="metric-name">{entry.title}</span>

                <strong className="metric-value">{entry.value}</strong>
              </>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <button className="inline-add" onClick={addEntry}>
          + Add metric
        </button>
      )}
    </div>
  );
}

function MilestoneDetail({
  card,
  editing,
  onChange,
}: {
  card: MilestoneCard;
  editing: boolean;
  onChange: (card: SnippetCard) => void;
}) {
  if (editing) {
    return (
      <div className="detail-form">
        <label className="field-label">
          Title
          <input
            value={card.title}
            onChange={(e) =>
              onChange(updateCard(card, { title: e.target.value }))
            }
          />
        </label>
        <label className="field-label">
          Description
          <textarea
            rows={5}
            value={card.description}
            onChange={(e) =>
              onChange(updateCard(card, { description: e.target.value }))
            }
          />
        </label>
        <div className="two-col-fields">
          <label className="field-label">
            Status
            <select
              value={card.status}
              onChange={(e) =>
                updateCard(card, {
                  status: e.target.value as MilestoneCard["status"],
                })
              }
            >
              <option value="planned">Planned</option>
              <option value="in-progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label className="field-label">
            Date
            <input
              type="date"
              value={card.date ?? ""}
              onChange={(e) =>
                onChange(updateCard(card, { date: e.target.value }))
              }
            />
          </label>
        </div>
      </div>
    );
  }
  return (
    <div className="milestone-detail">
      <span className="status-pill">{card.status.replace("-", " ")}</span>
      <h2>{card.title}</h2>
      <p>{card.description}</p>
      {card.date && <time>{card.date}</time>}
    </div>
  );
}

function ImageDetail({
  card,
  editing,
  onChange,
}: {
  card: ImageCard;
  editing: boolean;
  onChange: (card: SnippetCard) => void;
}) {
  return (
    <div className="image-detail">
      <div className="image-placeholder">
        <img
          src={card.imageUrl}
          alt={card.altText || card.title || "Project image"}
        />
      </div>
      {editing ? (
        <div className="detail-form">
          <label className="field-label">
            Title
            <input
              value={card.title}
              onChange={(e) =>
                onChange(updateCard(card, { title: e.target.value }))
              }
            />
          </label>
          <label className="field-label">
            Caption
            <input
              value={card.caption ?? ""}
              onChange={(e) =>
                onChange(updateCard(card, { caption: e.target.value }))
              }
            />
          </label>
          <label className="field-label">
            Alt text
            <input
              value={card.altText}
              onChange={(e) =>
                onChange(updateCard(card, { altText: e.target.value }))
              }
            />
          </label>
        </div>
      ) : (
        <div className="image-copy">
          <h2>{card.title}</h2>
          {card.caption && <p>{card.caption}</p>}
        </div>
      )}
    </div>
  );
}
