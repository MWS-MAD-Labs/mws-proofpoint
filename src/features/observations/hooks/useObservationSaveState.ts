"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { saveObservationAnswer } from "../api/queries";
import { observationKeys } from "../api/queryKeys";
import type {
  ObservationAnswerInput,
  ObservationAnswerSaveResponse,
  ObservationDetailResponse,
} from "../types";

export type ObservationItemSaveStatus =
  | "saved"
  | "unsaved"
  | "saving"
  | "failed";

export interface ObservationItemSaveState {
  status: ObservationItemSaveStatus;
  error: string | null;
  savedAt: string | null;
}

const savedState: ObservationItemSaveState = {
  status: "saved",
  error: null,
  savedAt: null,
};

export function useObservationSaveState(observationId: string) {
  const queryClient = useQueryClient();
  const [states, setStates] = useState<Record<string, ObservationItemSaveState>>({});
  const payloads = useRef(new Map<string, ObservationAnswerInput>());
  const controllers = useRef(new Map<string, AbortController>());
  const requestVersions = useRef(new Map<string, number>());

  const updateState = useCallback(
    (indicatorId: string, update: Partial<ObservationItemSaveState>) => {
      setStates((current) => ({
        ...current,
        [indicatorId]: { ...(current[indicatorId] ?? savedState), ...update },
      }));
    },
    [],
  );

  const markUnsaved = useCallback(
    (indicatorId: string, input?: ObservationAnswerInput) => {
      if (input) payloads.current.set(indicatorId, input);
      else payloads.current.delete(indicatorId);
      controllers.current.get(indicatorId)?.abort();
      requestVersions.current.set(
        indicatorId,
        (requestVersions.current.get(indicatorId) ?? 0) + 1,
      );
      updateState(indicatorId, { status: "unsaved", error: null });
    },
    [updateState],
  );

  const updateDetailCache = useCallback(
    (result: ObservationAnswerSaveResponse) => {
      queryClient.setQueryData<ObservationDetailResponse>(
        observationKeys.detail(observationId),
        (current) => {
          if (!current) return current;
          const answers = current.observation.answers ?? [];
          const answerIndex = answers.findIndex(
            (answer) => answer.indicatorId === result.answer.indicatorId,
          );
          const nextAnswers = [...answers];
          if (answerIndex >= 0) nextAnswers[answerIndex] = result.answer;
          else nextAnswers.push(result.answer);
          return {
            ...current,
            observation: {
              ...current.observation,
              answers: nextAnswers,
              progress: result.progress,
              updatedAt: result.savedAt,
            },
          };
        },
      );
    },
    [observationId, queryClient],
  );

  const save = useCallback(
    async (indicatorId: string, input?: ObservationAnswerInput) => {
      const nextInput = input ?? payloads.current.get(indicatorId);
      if (!nextInput) return;

      payloads.current.set(indicatorId, nextInput);
      controllers.current.get(indicatorId)?.abort();
      const controller = new AbortController();
      controllers.current.set(indicatorId, controller);
      const version = (requestVersions.current.get(indicatorId) ?? 0) + 1;
      requestVersions.current.set(indicatorId, version);
      updateState(indicatorId, { status: "saving", error: null });

      try {
        const result = await saveObservationAnswer(
          observationId,
          indicatorId,
          nextInput,
          controller.signal,
        );
        if (requestVersions.current.get(indicatorId) !== version) return;
        payloads.current.delete(indicatorId);
        updateDetailCache(result);
        updateState(indicatorId, {
          status: "saved",
          error: null,
          savedAt: result.savedAt,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (requestVersions.current.get(indicatorId) !== version) return;
        updateState(indicatorId, {
          status: "failed",
          error: error instanceof Error ? error.message : "Save failed.",
        });
      }
    },
    [observationId, updateDetailCache, updateState],
  );

  const retryFailed = useCallback(async () => {
    const failedIds = Object.entries(states)
      .filter(([, state]) => state.status === "failed")
      .map(([indicatorId]) => indicatorId);
    await Promise.all(failedIds.map((indicatorId) => save(indicatorId)));
  }, [save, states]);

  const hasPendingChanges = useMemo(
    () =>
      Object.values(states).some((state) =>
        ["unsaved", "saving", "failed"].includes(state.status),
      ),
    [states],
  );
  const failedCount = useMemo(
    () => Object.values(states).filter((state) => state.status === "failed").length,
    [states],
  );
  const latestSavedAt = useMemo(() => {
    const timestamps = Object.values(states)
      .map((state) => state.savedAt)
      .filter((value): value is string => Boolean(value));
    return timestamps.sort().at(-1) ?? null;
  }, [states]);

  useEffect(() => {
    if (!hasPendingChanges) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const confirmNavigation = () =>
      window.confirm("You have changes that are not safely saved. Leave this page?");
    const protectLinks = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const target = event.target instanceof Element ? event.target.closest("a") : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      if (target.target === "_blank" || target.hasAttribute("download")) return;
      const destination = new URL(target.href, window.location.href);
      if (destination.href === window.location.href || destination.hash) return;
      if (!confirmNavigation()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const protectHistory = () => {
      if (!confirmNavigation()) window.history.forward();
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", protectHistory);
    document.addEventListener("click", protectLinks, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", protectHistory);
      document.removeEventListener("click", protectLinks, true);
    };
  }, [hasPendingChanges]);

  useEffect(
    () => () => {
      controllers.current.forEach((controller) => controller.abort());
    },
    [],
  );

  return {
    states,
    markUnsaved,
    save,
    retryFailed,
    hasPendingChanges,
    failedCount,
    latestSavedAt,
  };
}
