// An AI task = prompt builder + deterministic fallback (used when the LLM is unconfigured or fails,
// so the demo never breaks).
export interface AITask<I = any, O = any> {
  system: string;
  prompt: (input: I) => string;
  fallback: (input: I) => O;
  maxTokens?: number;
}
