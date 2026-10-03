import Link from "next/link";
import { Logo } from "@/components/logo";
import { MODULES } from "@/lib/modules";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 md:px-12 py-6">
        <Logo />
        <Link href="/login" className="text-sm font-semibold text-ink-2 hover:text-ink">Sign in →</Link>
      </header>
      <main className="flex-1 grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center px-6 md:px-12 pb-16 max-w-7xl mx-auto w-full">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-line-2 px-3 py-1 text-xs text-ink-2 mb-6">
            <span className="live-dot" /> For student founders of community service projects
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[0.95]">
            Build the project.<br />
            <span className="serif italic font-normal grad-text">Then run it.</span>
          </h1>
          <p className="text-lg text-ink-2 mt-6 max-w-xl">
            Tell Foundry about your idea. It snaps together the exact toolkit you need — team roster, event planner,
            fundraising tracker, social pulse, finances — into <em className="serif text-ink text-xl">your own</em> project management app.
            No spreadsheets.
          </p>
          <div className="flex gap-3 mt-8">
            <Link href="/login?mode=signup" className="h-12 px-6 rounded-xl font-semibold inline-flex items-center bg-gradient-to-r from-[#ffb3a0] via-accent to-accent-2 text-[#2a1208] shadow-[0_6px_24px_-8px_rgba(255,154,118,0.7)]">
              Start a project — free
            </Link>
            <Link href="/login" className="h-12 px-6 rounded-xl font-semibold inline-flex items-center border border-line-2 hover:bg-panel-2">
              Join with a code
            </Link>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-8 bg-gradient-to-br from-accent/20 via-violet/10 to-transparent blur-3xl rounded-full" />
          <div className="relative glass rounded-3xl p-6 dot-grid">
            <div className="rounded-2xl bg-white text-[#1a1020] px-5 py-3 font-extrabold w-fit shadow-lg">🌱 Project Core</div>
            {MODULES.map((m, i) => (
              <div key={m.id} className="ml-4 -mt-0.5 rounded-2xl px-5 py-3.5 font-bold shadow-lg w-fit flex items-center gap-3 relative"
                style={{ background: m.color, color: m.ink, marginLeft: 16 + (i % 2) * 10, transform: `rotate(${i % 2 ? 0.6 : -0.6}deg)`, marginTop: 6 }}>
                <span className="text-xl">{m.emoji}</span>
                <span>{m.name}</span>
                {!m.core && <span className="text-[10px] uppercase tracking-wider opacity-70 bg-black/10 rounded px-1.5 py-0.5">optional</span>}
              </div>
            ))}
            <div className="mt-5 text-sm text-ink-2 flex items-center gap-2">✨ <span>AI picks the right blocks from a one-paragraph description.</span></div>
          </div>
        </div>
      </main>
    </div>
  );
}
