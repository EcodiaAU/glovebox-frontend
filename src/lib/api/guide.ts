// src/lib/api/guide.ts
import { api } from "./client";
import type { GuideTurnRequest, GuideTurnResponse } from "@/lib/types/guide";

// The signed-in person's resolved Ecodia Friend name (null when not connected).
// Powers the floating-chat header so the assistant reads as their SAME Friend.
export type GuideFriend = { name: string | null; connected: boolean };

export const guideApi = {
  // POST /guide/turn -> GuideTurnResponse
  turn: (req: GuideTurnRequest) => api.post<GuideTurnResponse>("/guide/turn", req),
  // GET /guide/friend -> resolved Friend name for this signed-in person
  friend: () => api.get<GuideFriend>("/guide/friend"),
};
