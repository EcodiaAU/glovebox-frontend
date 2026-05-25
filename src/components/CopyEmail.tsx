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

  return (
    <a
      href={`mailto:${email}`}
      className={className}
      onClick={onClick}
      data-copied={copied || undefined}
    >
      {copied ? "copied" : (children ?? email)}
    </a>
  );
}
