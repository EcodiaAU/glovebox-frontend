// src/components/ui/OfflineStatusIndicator.tsx

import { useEffect, useState } from "react";
import { useNetworkStatus } from "@/lib/hooks/useNetworkStatus";

/**
 * Persistent global offline status indicator.
 *
 * Always visible in the header - never dismissable.
 * Three states:
 *   - Online: hidden (show nothing)
 *   - Degraded (Solar Amber dot + "No server") - device online but backend unreachable
 *   - Offline (Emergency Red pulsing dot + "OFFLINE MODE" + optional region/version subtitle)
 *
 * Startup grace: the backend health probe takes a few seconds to land its
 * first response. We don't want every page load to flash "No Server" while
 * the probe is in flight, so suppress the degraded (backend-only) state for
 * `STARTUP_GRACE_MS`. A genuinely offline device (no network at all) still
 * shows immediately because the browser knows that synchronously.
 */
const STARTUP_GRACE_MS = 8000;

export function OfflineStatusIndicator({
  offlineRegion,
  offlineVersion,
}: {
  /** e.g. "NT Region" */
  offlineRegion?: string;
  /** e.g. "v24.2" */
  offlineVersion?: string;
}) {
  const { deviceOnline, backendReachable } = useNetworkStatus();
  const [graceElapsed, setGraceElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setGraceElapsed(true), STARTUP_GRACE_MS);
    return () => clearTimeout(t);
  }, []);

  // Online - show nothing
  if (deviceOnline && backendReachable) return null;

  // During grace window, suppress the soft "degraded" state. Hard offline
  // (no device network) is still surfaced because the user benefits from
  // immediate feedback.
  if (deviceOnline && !backendReachable && !graceElapsed) return null;

  let stateClass: string;
  let label: string;

  if (!deviceOnline) {
    stateClass = "terra-offline-indicator--offline";
    label = "Offline Mode";
  } else {
    stateClass = "terra-offline-indicator--degraded";
    label = "No Server";
  }

  const hasSubtitle = !deviceOnline && (offlineRegion || offlineVersion);
  const subtitle = hasSubtitle
    ? [offlineRegion, offlineVersion].filter(Boolean).join(" ")
    : null;

  return (
    <span
      className={`terra-offline-indicator-enhanced ${stateClass}`}
      role="status"
      aria-live="polite"
      aria-label={`Network status: ${label}${subtitle ? `, ${subtitle}` : ""}`}
    >
      <span className="terra-offline-dot" aria-hidden="true" />
      <span className="terra-offline-content">
        <span className="terra-offline-label">{label}</span>
        {subtitle && (
          <span className="terra-offline-subtitle">{subtitle}</span>
        )}
      </span>
    </span>
  );
}
