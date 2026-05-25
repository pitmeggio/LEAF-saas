"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Avatar, TrendArrow, ScorePill, Verified } from "@/components/ui";
import { STATUSES, STATUS_LABEL, STATUS_COLOR, DISCIPLINE_LABEL, COUNTRY, fmtPoints, type Status, type Trend } from "@/lib/domain";
import { moveApplication } from "@/app/actions";
import { getSportModule } from "@/lib/sports/registry";

export type Card = {
  id: string;
  athleteId: string;
  firstName: string;
  lastName: string;
  photoColor: string;
  nationality: string;
  discipline: string;
  age: number;
  fisPoints: number | null;
  // Tennis profile snippets — used by the card when the academy sport is
  // a non-federation sport. Null for ski applications.
  playingStyle: string | null;
  status: Status;
  score: number | null;
  verified: boolean;
  source: string;
  trend: Trend;
  suggestedGroup: string | null; // auto-placement (Smart Group Assignment)
};

export function KanbanBoard({ initial, sport = "ski" }: { initial: Card[]; sport?: string }) {
  // Sport module decides which snippet the card surfaces — federation
  // sports show ranking points; match-record sports show playing style.
  const sportModule = getSportModule(sport);
  const [cards, setCards] = useState(initial);
  const [, startTransition] = useTransition();

  function onDragEnd(result: DropResult) {
    const { destination, draggableId } = result;
    if (!destination) return;
    const to = destination.droppableId as Status;
    const card = cards.find((c) => c.id === draggableId);
    if (!card || card.status === to) return;

    setCards((prev) => prev.map((c) => (c.id === draggableId ? { ...c, status: to } : c)));
    startTransition(() => {
      moveApplication(draggableId, to);
    });
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto p-8">
        {STATUSES.map((status) => {
          const col = cards.filter((c) => c.status === status);
          const color = STATUS_COLOR[status];
          return (
            <Droppable droppableId={status} key={status}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex w-72 shrink-0 flex-col rounded-xl border transition-colors ${
                    snapshot.isDraggingOver ? "border-[var(--color-accent)]/60 bg-[var(--color-surface-2)]" : "border-[var(--color-border)] bg-[var(--color-surface)]"
                  }`}
                >
                  <div className="flex items-center justify-between px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                      <span className="text-sm font-semibold">{STATUS_LABEL[status]}</span>
                    </div>
                    <span className="num rounded-md bg-[var(--color-surface-2)] px-2 py-0.5 text-xs text-[var(--color-muted)]">
                      {col.length}
                    </span>
                  </div>

                  <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
                    {col.map((c, i) => (
                      <Draggable draggableId={c.id} index={i} key={c.id}>
                        {(dp, ds) => (
                          <div
                            ref={dp.innerRef}
                            {...dp.draggableProps}
                            {...dp.dragHandleProps}
                            className={`card-2 p-3 ${ds.isDragging ? "ring-1 ring-[var(--color-accent)]" : ""}`}
                          >
                            <div className="flex items-start gap-2">
                              <Avatar first={c.firstName} last={c.lastName} color={c.photoColor} size={36} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 text-sm font-medium leading-tight">
                                  <span className="truncate">
                                    {c.firstName} {c.lastName}
                                  </span>
                                  {c.verified && <Verified />}
                                </div>
                                <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                                  {COUNTRY[c.nationality]?.flag} {c.age}y · {DISCIPLINE_LABEL[c.discipline]}
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between">
                              {/* Sport-aware applicant snippet — federation
                                  sports surface ranking points (FIS), match-
                                  record sports surface playing style. */}
                              {sportModule.hasFederationRanking ? (
                                <div className="num text-xs text-[var(--color-muted)]">
                                  <span className="text-[var(--color-fg)] font-semibold">{fmtPoints(c.fisPoints)}</span> FIS
                                </div>
                              ) : (
                                <div className="truncate text-xs text-[var(--color-muted)]">
                                  {c.playingStyle ? (
                                    <><span className="uppercase tracking-wide text-[10px]">Style</span> <span className="text-[var(--color-fg)]">{c.playingStyle}</span></>
                                  ) : (
                                    <span className="text-[var(--color-muted)]">No style set</span>
                                  )}
                                </div>
                              )}
                              <div className="flex items-center gap-3">
                                {c.score != null && <ScorePill score={c.score} />}
                                <TrendArrow trend={c.trend} />
                              </div>
                            </div>

                            {c.suggestedGroup && (
                              <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-[var(--color-surface)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]">
                                ⟐ Auto-group: <span className="font-medium text-[var(--color-fg)]">{c.suggestedGroup}</span>
                              </div>
                            )}

                            <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border)] pt-2">
                              <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                                {c.source === "marketplace" ? "★ marketplace" : "form"}
                              </span>
                              <Link href={`/dashboard/applications/${c.id}`} className="text-[11px] text-[var(--color-accent)] hover:underline">
                                Open →
                              </Link>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}
