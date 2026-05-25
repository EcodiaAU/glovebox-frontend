"use client";

import { useState, useCallback, type MouseEvent } from "react";

type CopyEmailProps = {
  email?: string;
  className?: string;
  children?: React.ReactNode;
};

/**
 * CopyEmail - anchor that copies the email to clipboard on click and shows
 * "copied" feedback for ~1.4s. Falls through to the mailto: href if the
 * Clipboard API isn't available (rare).
 */
export default function CopyEmail({
  email = "code@ecodia.au",
  className,
  children,
}: CopyEmailProps) {
  const [copied, setCopied] = useState(false);

  const onClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      if (typeof navigator === "undefined" || !navigator.clipboard) return;
      e.preventDefault();
      navigator.clipboard
        .writeText(email)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        })
        .catch(() => {
          window.location.href = `mailto:${email}`;
        });
    },
    [email],
  );

  // Fix the row reflow when "code@ecodia.au" swaps to "copied" - reserve
  // the wider of the two widths inside the anchor so nothing shifts.
  const label = (children ?? email) as React.ReactNode;
  return (
    <a
      href={`mailto:${email}`}
      className={className}
      onClick={onClick}
      data-copied={copied || undefined}
      style={{ display: "inline-block", minWidth: "14ch", textAlign: "center" }}
    >
      {copied ? "copied" : label}
    </a>
  );
}
