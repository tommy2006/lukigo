"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Pencil, Sparkles, Wand2 } from "lucide-react";
import { RequireAuth } from "@/components/auth";
import { askAI } from "@/lib/ai/client";
import { MODULE_MAP } from "@/lib/modules";
import type { StackItem } from "@/lib/types";
import { Button, Card, Field, Input, Textarea, Tip, cx } from "@/components/ui";
import { Logo } from "@/components/logo";
import type { OnboardQuestion } from "@/lib/ai/tasks/core";

import { DRAFT_KEY, type Draft } from "@/lib/draft";

const EXAMPLES = [
  "A free weekend tutoring program where high schoolers teach coding to middle schoolers at the public library.",
  "We run beach cleanups every month and want to sell reusable tote bags to fund supplies.",
  "A food drive network between 3 schools that delivers to local shelters, plus a big winter fundraiser gala.",
];

export default function OnboardingPage() {
  return <RequireAuth><Onboarding /></RequireAuth>;
}

type Rec = { name: string; tagline: string; emoji: string; cause: string; stack: (StackItem & { reason?: string })[]; first_steps: string[]; _source: string };

function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [desc, setDesc] = useState("");
  const [intro, setIntro] = useState("");
  const [questions, setQuestions] = useState<OnboardQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [rec, setRec] = useState<Rec | null>(null);
  const [loading, setLoading] = useState(false);

  async function getQuestions() {
    setLoading(true);
    try {
      const r = await askAI<{ intro: string; questions: OnboardQuestion[] }>("onboard_questions", { description: desc });
      setIntro(r.intro); setQuestions(r.questions || []); setStep(1);
    } finally { setLoading(false); }
  }

  async function getRecommendation() {
    setLoading(true);
    try {
      const r = await askAI<Rec>("recommend_modules", {
        description: desc,
        answers: questions.map((q) => ({ question: q.question, answer: (answers[q.id] || []).join(", ") || "skipped" })),
      });
      // sanitize: only known modules/submodules
      r.stack = (r.stack || []).filter((s) => MODULE_MAP[s.id]).map((s) => ({
        ...s, submodules: (s.submodules || []).filter((x) => MODULE_MAP[s.id].submodules.some((m) => m.id === x)),
      }));
      if (!r.emoji?.trim()) r.emoji = "🌱";
      setRec(r); setStep(2);
    } finally { setLoading(false); }
  }

  function toggle(q: OnboardQuestion, opt: string) {
    setAnswers((a) => {
      const cur = a[q.id] || [];
      if (!q.multi) return { ...a, [q.id]: [opt] };
      return { ...a, [q.id]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
    });
  }

  function openBuilder(r: Rec | null) {
    const draft: Draft = r
      ? { name: r.name, tagline: r.tagline, emoji: r.emoji, cause: r.cause, description: desc,
          stack: r.stack.map(({ id, submodules }) => ({ id, submodules })),
          reasons: Object.fromEntries(r.stack.map((s) => [s.id, s.reason || ""])), first_steps: r.first_steps }
      : { name: "", tagline: "", emoji: "🌱", cause: "community", description: desc, stack: [] };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    router.push("/build");
  }

  const steps = ["Your idea", "A few questions", "Your toolkit"];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 md:px-10 py-5">
        <Link href="/home"><Logo /></Link>
        <button onClick={() => openBuilder(null)} className="text-sm text-ink-3 hover:text-ink">Skip AI setup → build manually</button>
      </header>
      <div className="flex justify-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s} className={cx("flex items-center gap-2 text-xs font-semibold rounded-full px-3 py-1.5 border", i === step ? "border-accent/50 text-accent bg-accent/10" : i < step ? "border-good/40 text-good" : "border-line text-ink-3")}>
            {i < step ? <Check className="size-3" /> : <span className="font-mono">{i + 1}</span>} {s}
          </div>
        ))}
      </div>

      <div className="flex-1 w-full max-w-3xl mx-auto px-6 pb-16">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">What do you want to <span className="serif italic font-normal grad-text">change?</span></h1>
              <p className="text-ink-2 mt-3">Describe your project in your own words — who you want to help, how, and with whom. Messy is fine. Lukigo&apos;s AI will turn it into a ready-to-run toolkit.</p>
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="mt-6 min-h-40 text-base" placeholder="e.g. I want to start a club that…" autoFocus />
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-xs text-ink-3 py-1.5">Need inspiration?</span>
                {EXAMPLES.map((e) => (
                  <button key={e} onClick={() => setDesc(e)} className="text-xs text-left rounded-lg border border-line px-3 py-1.5 text-ink-2 hover:border-line-2 hover:text-ink max-w-xs truncate">{e}</button>
                ))}
              </div>
              <div className="mt-8 flex items-center justify-between">
                <span className="text-xs text-ink-3">{desc.length < 20 ? "A sentence or two is enough." : "Looking good!"}</span>
                <Button variant="ai" size="lg" onClick={getQuestions} loading={loading} disabled={desc.trim().length < 10}><Sparkles className="size-4" /> Continue</Button>
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-5">
              <div className="flex gap-3 items-start">
                <div className="size-9 rounded-full bg-gradient-to-br from-[#9ad8ff] to-violet grid place-items-center shrink-0"><Wand2 className="size-4 text-[#140d33]" /></div>
                <div className="glass rounded-2xl rounded-tl-sm px-4 py-3 text-ink">{intro || "Great idea!"} Just a few quick questions — tap whatever fits.</div>
              </div>
              {questions.map((q, qi) => (
                <motion.div key={q.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: qi * 0.08 }}>
                  <Card>
                    <div className="font-semibold mb-3">{q.question} {q.multi && <span className="text-xs text-ink-3 font-normal">(pick any)</span>}</div>
                    <div className="flex flex-wrap gap-2">
                      {q.options.map((o) => {
                        const on = answers[q.id]?.includes(o);
                        return (
                          <button key={o} onClick={() => toggle(q, o)}
                            className={cx("rounded-xl px-3.5 py-2 text-sm border transition", on ? "border-accent bg-accent/15 text-ink" : "border-line text-ink-2 hover:border-line-2")}>
                            {on && <Check className="inline size-3.5 mr-1 text-accent" />}{o}
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                </motion.div>
              ))}
              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(0)}>← Back</Button>
                <Button variant="ai" size="lg" onClick={getRecommendation} loading={loading}><Sparkles className="size-4" /> Build my toolkit</Button>
              </div>
            </motion.div>
          )}

          {step === 2 && rec && (
            <motion.div key="s2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
              <h1 className="text-4xl font-extrabold tracking-tight">Here&apos;s your <span className="serif italic font-normal grad-text">starter kit.</span></h1>
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="font-extrabold">Name your project</div>
                    <div className="text-sm text-ink-3">AI suggested these — change anything you like. You can edit them again later.</div>
                  </div>
                  <Pencil className="size-4 text-ink-3" />
                </div>
                <div className="grid grid-cols-[72px_1fr] gap-4 items-start">
                  <Field label="Icon">
                    <input value={rec.emoji} onChange={(e) => setRec({ ...rec, emoji: e.target.value })} maxLength={4} aria-label="Project emoji"
                      className="!w-[72px] h-[72px] rounded-2xl bg-white/[0.04] border border-line text-4xl text-center outline-none focus:border-accent/60" />
                  </Field>
                  <div className="space-y-3 min-w-0">
                    <Field label="Project name">
                      <Input value={rec.name} onChange={(e) => setRec({ ...rec, name: e.target.value })} className="text-lg font-bold" placeholder="e.g. CodeBridge" />
                    </Field>
                    <Field label="Tagline" hint="one short line about what you do">
                      <Input value={rec.tagline} onChange={(e) => setRec({ ...rec, tagline: e.target.value })} placeholder="e.g. Teaching kids to code, one Saturday at a time." />
                    </Field>
                  </div>
                </div>
              </Card>
              <div className="grid sm:grid-cols-2 gap-3">
                {rec.stack.map((s, i) => {
                  const m = MODULE_MAP[s.id];
                  return (
                    <motion.div key={s.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
                      className="rounded-2xl p-4" style={{ background: m.color, color: m.ink }}>
                      <div className="font-extrabold flex items-center gap-2"><span className="text-xl">{m.emoji}</span>{m.name}</div>
                      <div className="text-sm mt-1 opacity-90">{s.reason}</div>
                      <div className="flex flex-wrap gap-1 mt-3">
                        {s.submodules.map((x) => <span key={x} className="text-[11px] font-semibold rounded-md bg-black/10 px-2 py-0.5">{m.submodules.find((q) => q.id === x)?.name}</span>)}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              {rec.first_steps?.length > 0 && (
                <Card>
                  <div className="font-bold mb-2">Your first 3 moves this week</div>
                  <ol className="space-y-1.5 text-ink-2 text-sm list-decimal list-inside">{rec.first_steps.map((f) => <li key={f}>{f}</li>)}</ol>
                </Card>
              )}
              <Tip title="Next">You&apos;ll see these blocks in the builder. Drag more in, remove ones you don&apos;t need, and toggle features inside each block. Nothing is permanent — you can change it later.</Tip>
              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(1)}>← Back</Button>
                <Button size="lg" onClick={() => openBuilder(rec)}>Open in builder <ArrowRight className="size-4" /></Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
