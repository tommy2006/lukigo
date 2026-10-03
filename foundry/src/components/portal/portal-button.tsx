import Link from "next/link";
import { Compass } from "lucide-react";

/** Small top-bar entry point to the public Project Portal. */
export function PortalButton({ className = "" }: { className?: string }) {
  return (
    <Link href="/discover" title="Discover projects to join"
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-line-2 text-[13px] font-semibold text-ink-2 hover:text-ink hover:border-accent/50 hover:bg-accent/10 transition ${className}`}>
      <Compass className="size-3.5" /> Discover
    </Link>
  );
}
