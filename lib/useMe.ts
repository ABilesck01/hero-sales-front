"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export type Me = {
  authUserId: string;
  email: string | null;
  profileId: number;
  fullname: string | null;
  isAdmin: boolean;
};

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const r = await apiFetch<{ data: Me }>("/api/me");
        if (active) setMe(r.data);
      } catch {
        if (active) setMe(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  return { me, loading };
}
