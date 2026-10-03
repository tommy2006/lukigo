export function Logo({ small }: { small?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${small ? "text-base" : "text-xl"}`}>
      <span className="relative inline-grid grid-cols-2 gap-[2px]" style={{ width: small ? 16 : 20, height: small ? 16 : 20 }}>
        <span className="rounded-[3px] bg-[#ffb4a2]" /><span className="rounded-[3px] bg-[#ffd88a]" />
        <span className="rounded-[3px] bg-[#a8e6cf]" /><span className="rounded-[3px] bg-[#c3b5ff]" />
      </span>
      <span>Lukigo</span>
    </span>
  );
}
