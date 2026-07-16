// src/app/(app)/live/loading.tsx
// Route-level Suspense fallback for the Live "Go Now" page. Shares LiveSkeleton
// with ClientPage's boot gate so the loading shell is identical whether the
// delay is code-splitting (this file) or route-building (ClientPage).
import { LiveSkeleton } from "./LiveSkeleton";

export default function LiveLoading() {
  return <LiveSkeleton />;
}
