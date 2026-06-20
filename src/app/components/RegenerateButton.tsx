"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Forces a fresh Claude generation for the given date, then refreshes the page. */
export function RegenerateButton({ date }: { date: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function regenerate() {
    setLoading(true);
    try {
      await fetch("/api/brief/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="btn" onClick={regenerate} disabled={loading}>
      {loading ? "Regenerating…" : "Regenerate brief"}
    </button>
  );
}
