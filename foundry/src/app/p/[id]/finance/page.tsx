"use client";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Pencil, Plus, ShoppingBag, Sparkles, Trash2 } from "lucide-react";
import { ModuleGate } from "@/components/module-gate";
import { useProject } from "@/components/project-context";
import { supabase } from "@/lib/supabase";
import { askAI } from "@/lib/ai/client";
import { activeLinks, hasSub } from "@/lib/modules";
import { can } from "@/lib/roles";
import type { Donation, EventRow, Fundraiser, MerchItem, MerchSale, Transaction } from "@/lib/types";
import { AIBox, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Progress, Select, Stat, Tip, cx, fmtDate, fmtMoney, todayISO } from "@/components/ui";
import { NoPerm, pct, sum, useRows } from "@/components/modules/shared";

const INCOME_CATS = ["donation", "merch", "sponsorship", "grant", "other"];
const EXPENSE_CATS = ["venue", "supplies", "marketing", "food", "transport", "merch", "other"];
const CAT_COLOR: Record<string, string> = { donation: "#7ee0a8", merch: "#ffd88a", sponsorship: "#9ad8ff", grant: "#c3b5ff", venue: "#ffb4a2", supplies: "#ffd88a", marketing: "#ff9ad5", food: "#ffb74d", transport: "#64b5f6", other: "#a1a1aa" };

export default function FinancePage() {
  return <ModuleGate id="finance"><Finance /></ModuleGate>;
}

function Finance() {
  const { project, stack, me } = useProject();
  const links = activeLinks(stack);
  const eventsLinked = links.some((l) => l.from === "events" && l.to === "finance");
  const fundLinked = links.some((l) => l.from === "fundraising" && l.to === "finance");
  const sub = (s: string) => hasSub(stack, "finance", s);
  const [txs, reloadTx] = useRows<Transaction>("transactions", project.id, "occurred_on", false);
  const [items, reloadItems] = useRows<MerchItem>("merch_items", project.id, "created_at", true);
  const [sales, reloadSales] = useRows<MerchSale>("merch_sales", project.id);
  const [events] = useRows<EventRow>("events", eventsLinked ? project.id : null, "starts_at", true);
  const [fundraisers] = useRows<Fundraiser>("fundraisers", fundLinked ? project.id : null);
  const [donations] = useRows<Donation>("donations", fundLinked ? project.id : null);
  const canEdit = can(me, "finance", "edit");
  const canManage = can(me, "finance", "manage");

  const [txModal, setTxModal] = useState<Transaction | "income" | "expense" | null>(null);
  const [itemModal, setItemModal] = useState<MerchItem | "new" | null>(null);
  const [saleItem, setSaleItem] = useState<MerchItem | null>(null);

  const totalIn = sum(txs.filter((t) => t.kind === "income"), (t) => t.amount);
  const totalOut = sum(txs.filter((t) => t.kind === "expense"), (t) => t.amount);
  const merchRevenue = sum(sales, (s) => s.quantity * s.unit_price);
  const merchCost = sum(sales, (s) => s.quantity * Number(items.find((i) => i.id === s.item_id)?.unit_cost || 0));

  return (
    <div>
      <PageHeader emoji="🧾" title="Finance &" accent="Merch"
        subtitle="Every dollar in and out — so you always know how much you can spend, and can show your advisor clean books."
        actions={canEdit ? <>
          <Button variant="outline" onClick={() => setTxModal("expense")}><ArrowDownRight className="size-4 text-bad" />Expense</Button>
          <Button onClick={() => setTxModal("income")}><ArrowUpRight className="size-4" />Income</Button>
        </> : undefined}
      />
      {!canEdit && <div className="mb-4"><NoPerm>Only the president, VP, treasurer or Head of Finance can record money.</NoPerm></div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Money in" value={fmtMoney(totalIn)} color="var(--good)" />
        <Stat label="Money out" value={fmtMoney(totalOut)} color="var(--bad)" />
        <Stat label="Balance" value={fmtMoney(totalIn - totalOut)} color={totalIn - totalOut >= 0 ? "var(--ink)" : "var(--bad)"} />
        <Stat label="Merch profit" value={fmtMoney(merchRevenue - merchCost)} sub={merchRevenue ? `${pct(merchRevenue - merchCost, merchRevenue)}% margin` : "no sales yet"} />
      </div>
      {txs.length === 0 && <div className="mb-6"><Tip title="Start here">Log your starting cash (if any) as income, then record every purchase as an expense — keep receipts! {fundLinked && "Donations logged in Fundraising appear here automatically."}</Tip></div>}

      <div className="space-y-6">
        {sub("reports") && <Report project={project.name} txs={txs} totalIn={totalIn} totalOut={totalOut} events={events} items={items} sales={sales} />}

        {sub("cashflow") && txs.length > 0 && <Cashflow txs={txs} />}

        <div className="grid lg:grid-cols-2 gap-6">
          {fundLinked && (
            <Card>
              <h2 className="text-lg font-bold mb-3">Fundraising <span className="serif italic grad-text font-normal">progress</span></h2>
              {fundraisers.length === 0 ? <div className="text-sm text-ink-3">No campaigns yet.</div> : (
                <div className="space-y-3">
                  {fundraisers.map((f) => {
                    const r = sum(donations.filter((d) => d.fundraiser_id === f.id), (d) => d.amount);
                    return (
                      <div key={f.id}>
                        <div className="flex justify-between text-sm mb-1"><span className="truncate">{f.name}</span><span className="font-mono text-ink-2">{fmtMoney(r)} / {fmtMoney(f.goal)}</span></div>
                        <Progress value={pct(r, f.goal)} color="var(--good)" height={6} />
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
          {sub("budgets") && eventsLinked && (
            <Card>
              <h2 className="text-lg font-bold mb-3">Event <span className="serif italic grad-text font-normal">budgets</span></h2>
              {events.length === 0 ? <div className="text-sm text-ink-3">Create events and set a budget to compare plan vs. reality.</div> : (
                <div className="space-y-3">
                  {events.map((e) => {
                    const spent = sum(txs.filter((t) => t.event_id === e.id && t.kind === "expense"), (t) => t.amount);
                    const over = e.budget > 0 && spent > e.budget;
                    return (
                      <div key={e.id}>
                        <div className="flex justify-between text-sm mb-1"><span className="truncate">{e.name}</span><span className={cx("font-mono", over ? "text-bad" : "text-ink-2")}>{fmtMoney(spent)} / {e.budget ? fmtMoney(e.budget) : "—"}</span></div>
                        <Progress value={e.budget ? pct(spent, e.budget) : 0} color={over ? "var(--bad)" : "#9ad8ff"} height={6} />
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </div>

        {sub("ledger") && (
          <Card>
            <h2 className="text-lg font-bold mb-3">Ledger</h2>
            {txs.length === 0 ? <Empty emoji="📒" title="No transactions yet">Every bake-sale dollar and every poster you print goes here.</Empty> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-3"><th className="py-2 pr-3 font-semibold">Date</th><th className="pr-3 font-semibold">Description</th><th className="pr-3 font-semibold">Category</th>{eventsLinked && <th className="pr-3 font-semibold">Event</th>}<th className="text-right font-semibold">Amount</th><th /></tr></thead>
                  <tbody>
                    {txs.map((t) => (
                      <tr key={t.id} className="border-t border-line group">
                        <td className="py-2 pr-3 font-mono text-xs text-ink-3 whitespace-nowrap">{fmtDate(t.occurred_on)}</td>
                        <td className="pr-3">{t.description || <span className="text-ink-3">—</span>}</td>
                        <td className="pr-3"><Badge color={CAT_COLOR[t.category] || "#a1a1aa"}>{t.category}</Badge></td>
                        {eventsLinked && <td className="pr-3 text-xs text-ink-3">{events.find((e) => e.id === t.event_id)?.name || ""}</td>}
                        <td className={cx("text-right font-mono font-semibold whitespace-nowrap", t.kind === "income" ? "text-good" : "text-bad")}>{t.kind === "income" ? "+" : "−"}{fmtMoney(t.amount)}</td>
                        <td className="text-right pl-2 whitespace-nowrap opacity-0 group-hover:opacity-100">
                          {canEdit && <button onClick={() => setTxModal(t)} className="text-ink-3 hover:text-ink mr-1.5"><Pencil className="size-3.5" /></button>}
                          {canManage && <button onClick={async () => { if (confirm("Delete this transaction?")) { await supabase().from("transactions").delete().eq("id", t.id); reloadTx(); } }} className="text-ink-3 hover:text-bad"><Trash2 className="size-3.5" /></button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {sub("merch_inventory") && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">Merch <span className="serif italic grad-text font-normal">inventory</span></h2>
              {canEdit && <Button size="sm" variant="outline" onClick={() => setItemModal("new")}><Plus className="size-4" />Add item</Button>}
            </div>
            {items.length === 0 ? <Tip>Selling shirts, stickers or bracelets? Add each item with its price and what it cost you to make — Foundry will track stock and profit per sale.</Tip> : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((it) => {
                  const sold = sum(sales.filter((s) => s.item_id === it.id), (s) => s.quantity);
                  const margin = Number(it.price) - Number(it.unit_cost);
                  return (
                    <motion.div key={it.id} layout className="rounded-xl border border-line p-3 group">
                      <div className="flex items-start gap-3">
                        <div className="text-3xl">{it.emoji || "👕"}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold truncate">{it.name}</div>
                          <div className="text-xs text-ink-3"><span className="font-mono text-ink">{fmtMoney(it.price)}</span> · cost {fmtMoney(it.unit_cost)} · <span className={margin >= 0 ? "text-good" : "text-bad"}>{fmtMoney(margin)} margin</span></div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                          {canEdit && <button onClick={() => setItemModal(it)} className="text-ink-3 hover:text-ink"><Pencil className="size-3.5" /></button>}
                          {canManage && <button onClick={async () => { if (confirm(`Delete ${it.name}?`)) { await supabase().from("merch_items").delete().eq("id", it.id); reloadItems(); } }} className="text-ink-3 hover:text-bad"><Trash2 className="size-3.5" /></button>}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="text-xs"><span className={cx("font-mono font-bold", it.stock <= 3 ? "text-warn" : "")}>{it.stock}</span> <span className="text-ink-3">in stock · {sold} sold</span></div>
                        {sub("merch_sales") && canEdit && <Button size="sm" variant="outline" disabled={it.stock <= 0} onClick={() => setSaleItem(it)}><ShoppingBag className="size-3.5" />Sell</Button>}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {sub("merch_sales") && sales.length > 0 && (
          <Card>
            <h2 className="text-lg font-bold mb-3">Recent <span className="serif italic grad-text font-normal">sales</span></h2>
            <div className="divide-y divide-line">
              {sales.slice(0, 15).map((s) => {
                const it = items.find((i) => i.id === s.item_id);
                return (
                  <div key={s.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="text-xl">{it?.emoji || "📦"}</span>
                    <span className="flex-1">{s.quantity}× {it?.name || "Deleted item"}{s.buyer && <span className="text-ink-3"> → {s.buyer}</span>}</span>
                    <span className="text-xs text-ink-3 font-mono">{fmtDate(s.sold_on)}</span>
                    <span className="font-mono font-semibold text-good">+{fmtMoney(s.quantity * s.unit_price)}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      <Modal open={!!txModal} onClose={() => setTxModal(null)} title={typeof txModal === "object" && txModal ? "Edit transaction" : txModal === "expense" ? "Record an expense" : "Record income"}>
        {txModal && <TxForm projectId={project.id} meId={me?.id ?? null} t={typeof txModal === "object" ? txModal : null} kind={typeof txModal === "string" ? txModal : txModal.kind} events={events}
          onDone={() => { setTxModal(null); reloadTx(); }} />}
      </Modal>
      <Modal open={!!itemModal} onClose={() => setItemModal(null)} title={itemModal === "new" ? "Add merch item" : "Edit item"}>
        {itemModal && <ItemForm projectId={project.id} it={itemModal === "new" ? null : itemModal} onDone={() => { setItemModal(null); reloadItems(); }} />}
      </Modal>
      <Modal open={!!saleItem} onClose={() => setSaleItem(null)} title={`Sell ${saleItem?.name ?? ""}`}>
        {saleItem && <SaleForm projectId={project.id} meId={me?.id ?? null} it={saleItem} onDone={() => { setSaleItem(null); reloadItems(); reloadSales(); reloadTx(); }} />}
      </Modal>
    </div>
  );
}

function TxForm({ projectId, meId, t, kind: initialKind, events, onDone }: { projectId: string; meId: string | null; t: Transaction | null; kind: "income" | "expense"; events: EventRow[]; onDone: () => void }) {
  const [v, setV] = useState({ kind: t?.kind || initialKind, category: t?.category || (initialKind === "income" ? "donation" : "supplies"), amount: String(t?.amount ?? ""), description: t?.description || "", occurred_on: t?.occurred_on || todayISO(), event_id: t?.event_id || "" });
  const [saving, setSaving] = useState(false);
  const cats = v.kind === "income" ? INCOME_CATS : EXPENSE_CATS;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!(Number(v.amount) > 0)) return;
    setSaving(true);
    const row = { project_id: projectId, kind: v.kind, category: v.category, amount: Number(v.amount), description: v.description || null, occurred_on: v.occurred_on, event_id: v.event_id || null, ...(t ? {} : { recorded_by: meId }) };
    const { error } = t ? await supabase().from("transactions").update(row).eq("id", t.id) : await supabase().from("transactions").insert(row);
    setSaving(false);
    if (error) return alert(error.message);
    onDone();
  }
  return (
    <form onSubmit={save} className="space-y-4">
      <div className="flex rounded-xl border border-line p-0.5">
        {(["income", "expense"] as const).map((k) => (
          <button type="button" key={k} onClick={() => setV({ ...v, kind: k, category: k === "income" ? "donation" : "supplies" })}
            className={cx("flex-1 h-9 rounded-lg text-sm font-semibold capitalize", v.kind === k ? (k === "income" ? "bg-good/15 text-good" : "bg-bad/15 text-bad") : "text-ink-3")}>{k}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount ($)"><Input autoFocus type="number" min="0" step="0.01" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} /></Field>
        <Field label="Date"><Input type="date" value={v.occurred_on} onChange={(e) => setV({ ...v, occurred_on: e.target.value })} /></Field>
      </div>
      <Field label="Category"><Select value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>{cats.map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
      <Field label="Description"><Input value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder={v.kind === "income" ? "Bake sale cash box" : "Poster printing at Staples"} /></Field>
      {events.length > 0 && <Field label="Event" hint="optional"><Select value={v.event_id} onChange={(e) => setV({ ...v, event_id: e.target.value })}><option value="">—</option>{events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select></Field>}
      <div className="flex justify-end"><Button type="submit" loading={saving}>Save</Button></div>
    </form>
  );
}

function ItemForm({ projectId, it, onDone }: { projectId: string; it: MerchItem | null; onDone: () => void }) {
  const [v, setV] = useState({ name: it?.name || "", emoji: it?.emoji || "👕", price: String(it?.price ?? ""), unit_cost: String(it?.unit_cost ?? ""), stock: String(it?.stock ?? "") });
  const [saving, setSaving] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!v.name.trim()) return;
    setSaving(true);
    const row = { project_id: projectId, name: v.name.trim(), emoji: v.emoji || "👕", price: Number(v.price) || 0, unit_cost: Number(v.unit_cost) || 0, stock: Math.round(Number(v.stock) || 0) };
    const { error } = it ? await supabase().from("merch_items").update(row).eq("id", it.id) : await supabase().from("merch_items").insert(row);
    setSaving(false);
    if (error) return alert(error.message);
    onDone();
  }
  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid grid-cols-[70px_1fr] gap-3">
        <Field label="Emoji"><Input value={v.emoji} onChange={(e) => setV({ ...v, emoji: e.target.value })} className="text-center text-xl" /></Field>
        <Field label="Item name"><Input autoFocus value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Club T-shirt" /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Price ($)"><Input type="number" min="0" step="0.01" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} /></Field>
        <Field label="Cost ($)"><Input type="number" min="0" step="0.01" value={v.unit_cost} onChange={(e) => setV({ ...v, unit_cost: e.target.value })} /></Field>
        <Field label="Stock"><Input type="number" min="0" value={v.stock} onChange={(e) => setV({ ...v, stock: e.target.value })} /></Field>
      </div>
      {Number(v.price) > 0 && <div className="text-sm text-ink-2">Profit per sale: <span className="font-mono text-good">{fmtMoney(Number(v.price) - Number(v.unit_cost || 0))}</span> ({pct(Number(v.price) - Number(v.unit_cost || 0), Number(v.price))}%)</div>}
      <div className="flex justify-end"><Button type="submit" loading={saving}>Save</Button></div>
    </form>
  );
}

function SaleForm({ projectId, meId, it, onDone }: { projectId: string; meId: string | null; it: MerchItem; onDone: () => void }) {
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState(String(it.price));
  const [buyer, setBuyer] = useState("");
  const [saving, setSaving] = useState(false);
  const q = Math.max(1, Math.min(it.stock, Math.round(Number(qty) || 1)));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const unit = Number(price) || 0;
    const sb = supabase();
    const { error } = await sb.from("merch_sales").insert({ project_id: projectId, item_id: it.id, quantity: q, unit_price: unit, buyer: buyer || null, sold_on: todayISO() });
    if (error) { setSaving(false); return alert(error.message); }
    await Promise.all([
      sb.from("merch_items").update({ stock: Math.max(0, it.stock - q) }).eq("id", it.id),
      sb.from("transactions").insert({ project_id: projectId, kind: "income", category: "merch", amount: q * unit, description: `Sold ${q}× ${it.name}${buyer ? ` to ${buyer}` : ""}`, occurred_on: todayISO(), recorded_by: meId }),
    ]);
    setSaving(false);
    onDone();
  }
  return (
    <form onSubmit={save} className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3"><span className="text-3xl">{it.emoji}</span><div><div className="font-bold">{it.name}</div><div className="text-xs text-ink-3">{it.stock} in stock</div></div></div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantity"><Input autoFocus type="number" min="1" max={it.stock} value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
        <Field label="Price each ($)"><Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
      </div>
      <Field label="Buyer" hint="optional"><Input value={buyer} onChange={(e) => setBuyer(e.target.value)} /></Field>
      <div className="text-sm text-ink-2">Total <span className="font-mono text-good font-bold">{fmtMoney(q * (Number(price) || 0))}</span> — goes into the ledger as merch income.</div>
      <div className="flex justify-end"><Button type="submit" loading={saving}>Record sale</Button></div>
    </form>
  );
}

function Cashflow({ txs }: { txs: Transaction[] }) {
  const pts = useMemo(() => {
    const byDay: Record<string, number> = {};
    for (const t of txs) byDay[t.occurred_on] = (byDay[t.occurred_on] || 0) + (t.kind === "income" ? 1 : -1) * Number(t.amount);
    const out: { d: string; v: number }[] = [];
    for (const d of Object.keys(byDay).sort()) out.push({ d, v: (out.length ? out[out.length - 1].v : 0) + byDay[d] });
    return out;
  }, [txs]);
  const W = 800, H = 220, P = 32;
  const series = pts.length === 1 ? [{ d: pts[0].d, v: 0 }, pts[0]] : pts;
  const vs = series.map((p) => p.v);
  const min = Math.min(0, ...vs), max = Math.max(1, ...vs);
  const x = (i: number) => P + (i / Math.max(1, series.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - min) / (max - min || 1)) * (H - 2 * P);
  const line = series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(series.length - 1)},${y(min)} L${x(0)},${y(min)} Z`;
  const last = series[series.length - 1];
  return (
    <Card>
      <div className="flex items-end justify-between mb-2">
        <h2 className="text-lg font-bold">Cashflow</h2>
        <div className="text-right"><div className="text-[11px] uppercase tracking-wider text-ink-3">Balance now</div><div className={cx("font-mono text-xl font-bold", last.v >= 0 ? "text-good" : "text-bad")}>{fmtMoney(last.v)}</div></div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <defs>
          <linearGradient id="cf" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#7ee0a8" stopOpacity="0.35" /><stop offset="100%" stopColor="#7ee0a8" stopOpacity="0" /></linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const v = min + (max - min) * f;
          return <g key={f}><line x1={P} x2={W - P} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.06)" /><text x={P - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.4)" className="font-mono">{fmtMoney(v)}</text></g>;
        })}
        {min < 0 && <line x1={P} x2={W - P} y1={y(0)} y2={y(0)} stroke="rgba(255,122,122,0.4)" strokeDasharray="4 4" />}
        <motion.path d={area} fill="url(#cf)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
        <motion.path d={line} fill="none" stroke="#7ee0a8" strokeWidth="2.5" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1 }} />
        {series.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.v)} r="3" fill="#14111d" stroke="#7ee0a8" strokeWidth="2"><title>{`${p.d}: ${fmtMoney(p.v)}`}</title></circle>)}
        {[0, series.length - 1].filter((v, i, a) => a.indexOf(v) === i).map((i) => <text key={i} x={x(i)} y={H - 8} textAnchor={i ? "end" : "start"} fontSize="10" fill="rgba(255,255,255,0.4)">{fmtDate(series[i].d)}</text>)}
      </svg>
    </Card>
  );
}

function Report({ project, txs, totalIn, totalOut, events, items, sales }: { project: string; txs: Transaction[]; totalIn: number; totalOut: number; events: EventRow[]; items: MerchItem[]; sales: MerchSale[] }) {
  const [r, setR] = useState<{ summary: string; highlights: string[]; concerns: string[]; _source?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  async function run() {
    setLoading(true);
    const cats: Record<string, { category: string; kind: string; amount: number }> = {};
    for (const t of txs) { const k = t.kind + t.category; cats[k] ??= { category: t.category, kind: t.kind, amount: 0 }; cats[k].amount += Number(t.amount); }
    try {
      setR(await askAI("finance_report", {
        project, total_in: totalIn, total_out: totalOut, balance: totalIn - totalOut, by_category: Object.values(cats),
        events: events.map((e) => ({ name: e.name, budget: Number(e.budget) || 0, spent: sum(txs.filter((t) => t.event_id === e.id && t.kind === "expense"), (t) => t.amount) })),
        merch: items.map((i) => ({ name: i.name, stock: i.stock, sold: sum(sales.filter((s) => s.item_id === i.id), (s) => s.quantity) })),
      }));
    } finally { setLoading(false); }
  }
  return (
    <AIBox title="Finance report" loading={loading} source={r?._source}
      action={<Button size="sm" variant="ai" onClick={run} loading={loading}><Sparkles className="size-4" />{r ? "Refresh" : "Generate"}</Button>}>
      {!r ? <span className="text-sm text-ink-2">Get a plain-English summary of your money — perfect to paste into an email to your advisor.</span> : (
        <div className="space-y-3">
          <p>{r.summary}</p>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div><div className="font-bold text-good mb-1">Highlights</div><ul className="space-y-1 text-ink-2">{(r.highlights || []).map((h, i) => <li key={i}>• {h}</li>)}</ul></div>
            <div><div className="font-bold text-warn mb-1">Watch out</div><ul className="space-y-1 text-ink-2">{(r.concerns || []).length ? r.concerns.map((h, i) => <li key={i}>• {h}</li>) : <li>Nothing worrying. 🎉</li>}</ul></div>
          </div>
        </div>
      )}
    </AIBox>
  );
}
