"use client";
import { Suspense } from "react";
import { RequireAuth } from "@/components/auth";
import { Builder } from "@/components/builder/builder";

export default function BuildPage() {
  return <RequireAuth><Suspense><Builder /></Suspense></RequireAuth>;
}
