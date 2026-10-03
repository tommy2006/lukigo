"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button, Card, Field, Input } from "@/components/ui";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  return <Suspense><Login /></Suspense>;
}

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(null);
    const sb = supabase();
    if (mode === "signup") {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: name } } });
      if (error) { setErr(error.message); setLoading(false); return; }
      if (!data.session) { setErr("Check your email to confirm your account (or disable email confirmation in Supabase)."); setLoading(false); return; }
      await sb.from("profiles").upsert({ id: data.user!.id, email, full_name: name, school, grade });
      router.push("/home?welcome=1");
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) { setErr(error.message); setLoading(false); return; }
      router.push("/home");
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8"><Logo /></div>
        <Card className="p-7">
          <h1 className="text-3xl font-extrabold tracking-tight">
            {mode === "signup" ? <>Let&apos;s get <span className="serif italic font-normal grad-text">started</span></> : <>Welcome <span className="serif italic font-normal grad-text">back</span></>}
          </h1>
          <p className="text-ink-2 text-sm mt-1 mb-6">
            {mode === "signup" ? "One account for every project you found or join." : "Sign in to see your projects."}
          </p>
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <>
                <Field label="Full name"><Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Nguyen" /></Field>
                <div className="grid grid-cols-[2fr_1fr] gap-3">
                  <Field label="School"><Input value={school} onChange={(e) => setSchool(e.target.value)} placeholder="Lincoln High" /></Field>
                  <Field label="Grade"><Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="11" /></Field>
                </div>
              </>
            )}
            <Field label="Email"><Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu" /></Field>
            <Field label="Password"><Input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></Field>
            {err && <div className="text-sm text-bad bg-bad/10 border border-bad/25 rounded-lg px-3 py-2">{err}</div>}
            <Button className="w-full" size="lg" loading={loading}>{mode === "signup" ? "Create account" : "Sign in"}</Button>
          </form>
          <div className="text-center text-sm text-ink-3 mt-5">
            {mode === "signup" ? "Already have an account? " : "New here? "}
            <button className="text-accent font-semibold" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setErr(null); }}>
              {mode === "signup" ? "Sign in" : "Create an account"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
