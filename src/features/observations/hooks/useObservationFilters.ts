"use client";

import { useCallback, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  observationListQuerySchema,
  type ObservationListQuery,
} from "../schemas";

function roleDefaults(roles: readonly string[]): Partial<ObservationListQuery> {
  if (roles.includes("admin") || roles.includes("director")) {
    return { sort: "updated_desc" };
  }
  if (roles.includes("manager")) {
    return { managerId: "me", actionRequired: "true", sort: "updated_desc" };
  }
  return { actionRequired: "true", sort: "updated_desc" };
}

export function useObservationFilters(roles: readonly string[], loadingRoles: boolean) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasQuery = searchParams.size > 0;

  const filters = useMemo(
    () =>
      observationListQuerySchema.parse({
        ...(hasQuery ? {} : roleDefaults(roles)),
        ...Object.fromEntries(searchParams.entries()),
      }),
    [hasQuery, roles, searchParams],
  );

  useEffect(() => {
    if (loadingRoles || hasQuery) return;
    const defaults = roleDefaults(roles);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(defaults)) {
      if (value !== undefined) params.set(key, String(value));
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [hasQuery, loadingRoles, pathname, roles, router]);

  const updateFilters = useCallback(
    (updates: Partial<Record<keyof ObservationListQuery, string | number | undefined>>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      if (!("page" in updates)) next.set("page", "1");
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const clearFilters = useCallback(() => {
    const defaults = roleDefaults(roles);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(defaults)) {
      if (value !== undefined) params.set(key, String(value));
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, roles, router]);

  return { filters, updateFilters, clearFilters };
}
