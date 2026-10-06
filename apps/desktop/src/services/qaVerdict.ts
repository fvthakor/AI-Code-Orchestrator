export interface QaVerdict {
  approved: boolean;
  reasons: string[];
}

/** Index of the "}" that closes the object opened at `start`, honoring JSON strings. -1 if unclosed. */
function matchingBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Reads the QA agent's verdict from its log. Takes the last valid {"verdict": "approve" | "reject"} object.
 * Anything else (no object, invalid JSON, placeholder text from the prompt echo) counts as reject.
 */
export function parseQaVerdict(logs: string): QaVerdict {
  // Strip terminal color codes before searching
  const clean = logs.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "");
  const starts = [...clean.matchAll(/\{\s*"verdict"\s*:/g)].map((m) => m.index ?? 0);

  let found: { verdict: string; reasons?: unknown } | null = null;
  for (const start of starts) {
    const end = matchingBrace(clean, start);
    if (end === -1) continue;
    try {
      const parsed = JSON.parse(clean.slice(start, end + 1)) as { verdict?: unknown; reasons?: unknown };
      if (parsed.verdict === "approve" || parsed.verdict === "reject") {
        found = { verdict: parsed.verdict, reasons: parsed.reasons };
      }
    } catch {
      // Not a verdict object (e.g. the prompt's placeholder line); keep looking
    }
  }

  if (!found) {
    return { approved: false, reasons: ["QA agent produced no valid verdict"] };
  }
  return {
    approved: found.verdict === "approve",
    reasons: Array.isArray(found.reasons) ? found.reasons.map(String) : [],
  };
}
