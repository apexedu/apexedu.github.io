import { ReactNode, useState } from "react";
import { call, Row, scheduleWarm } from "./adminApi";
import { useCached } from "./cache";
import { btnDanger, btnGhost, btnPrimary, btnSmall, cardCls, ErrorBox, errText, Field, inputCls, Loading, Modal, PageHeader, Toggle } from "./ui";

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "bool" | "ref" | "photo" | "rating";
  refSheet?: string;
  hint?: string;
}
export interface ColDef { key: string; label: string; render?: (r: Row, refs: Record<string, Row[]>) => ReactNode }
export interface CrudConfig {
  sheet: string;
  required: string[];
  title: string;
  hint?: string;
  singular: string;
  columns: ColDef[];
  fields: FieldDef[];
  activeKey: "active" | "approved";
  activeLabel: string;
  ordered: boolean;
  canCreate: boolean;
}

// ---- Rasm yordamchilari (Drive havolasi / fayl ID'si / lokal fayl nomi) ----
const driveId = (u: string) =>
  u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=|thumbnail\?(?:[^#]*&)?id=)([\w-]{20,})/)?.[1] ??
  (/^[\w-]{25,}$/.test(u) ? u : null);

export const photoPreview = (url: string) => {
  const id = driveId(url);
  if (id) return `https://lh3.googleusercontent.com/d/${id}=w200`;
  return /^(https?:|data:)/.test(url) ? url : `../assets/teachers/${url.replace(/^\.?\/?(assets\/teachers\/)?/, "")}`;
};

// Brauzerda tik to'rtburchakka (4:5) qirqib, eni 800px gacha siqadi (JPEG). Saytdagi o'qituvchi kartasi ham 4:5.
async function compress(file: File): Promise<{ mime: string; data: string }> {
  const bmp = await createImageBitmap(file);
  const cw = Math.min(bmp.width, bmp.height * 0.8); // qirqiladigan joyning eni (4:5)
  const ch = cw * 1.25;
  const outW = Math.min(Math.round(cw), 800);
  const outH = Math.round(outW * 1.25);
  const cv = document.createElement("canvas");
  cv.width = outW;
  cv.height = outH;
  // Gorizontal — markazdan; vertikal — yuqoriroqdan (yuzlar odatda yuqorida bo'ladi)
  cv.getContext("2d")!.drawImage(bmp, (bmp.width - cw) / 2, (bmp.height - ch) * 0.2, cw, ch, 0, 0, outW, outH);
  const blob: Blob = await new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("invalid_file"))), "image/jpeg", 0.82));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { mime: "image/jpeg", data: btoa(bin) };
}

function PhotoField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function pick(f?: File) {
    if (!f) return;
    setBusy(true);
    setErr("");
    try {
      const { mime, data } = await compress(f);
      const r = await call<{ id: string }>("adminUploadPhoto", { mime, data });
      onChange(r.id);
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-4">
      {value ? (
        <img src={photoPreview(value)} alt="" referrerPolicy="no-referrer" className="h-28 w-[5.6rem] rounded-xl bg-slate-100 object-cover object-top" />
      ) : (
        <div className="h-28 w-[5.6rem] rounded-xl bg-slate-100" />
      )}
      <div className="min-w-0 space-y-1 text-sm">
        <input type="file" className="max-w-full" accept="image/*" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
        {busy && <p className="text-slate-500">Siqilib, Drive'ga yuklanmoqda...</p>}
        {err && <p className="text-red-700">{err}</p>}
        {value && !busy && <button type="button" className="text-red-700 underline" onClick={() => onChange("")}>Rasmni olib tashlash</button>}
      </div>
    </div>
  );
}

export default function CrudPage({ cfg }: { cfg: CrudConfig }) {
  const refSheet = cfg.fields.find((f) => f.type === "ref")?.refSheet;
  const { data: rows, error: loadErr, reload, mutate } = useCached<Row[]>(`sheet:${cfg.sheet}`, () => call<Row[]>("adminListSheet", { sheet: cfg.sheet }));
  const { data: refRows } = useCached<Row[]>(refSheet ? `sheet:${refSheet}` : "sheet:__none", () => (refSheet ? call<Row[]>("adminListSheet", { sheet: refSheet }) : Promise.resolve([])));
  const refs: Record<string, Row[]> = refSheet ? { [refSheet]: refRows ?? [] } : {};

  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<Row>({});
  const [formErr, setFormErr] = useState("");

  function openForm(row: Row | null) {
    setFormErr("");
    setIsNew(!row);
    setForm(row ? { ...row } : { [cfg.activeKey]: cfg.activeKey === "active", rating: 5 });
    setEditing(row ?? {});
  }

  // Optimistik saqlash: oyna darhol yopiladi, o'zgarish darhol ko'rinadi, server fonda yangilanadi
  async function save() {
    const missing = cfg.required.find((k) => !String(form[k] ?? "").trim());
    if (missing) { setFormErr("Majburiy maydonlar to'ldirilmagan."); return; }
    const payload: Row = {};
    cfg.fields.forEach((f) => { payload[f.key] = form[f.key] ?? (f.type === "bool" ? false : ""); });
    const editId = editing?.id;
    const before = rows;
    setEditing(null);
    setNotice("");
    if (isNew) {
      const tmp = "tmp-" + Math.random().toString(36).slice(2);
      mutate((rs) => [...(rs ?? []), { ...payload, id: tmp, _pending: true }]);
      try {
        const r = await call<{ id: string }>("adminUpsert", { sheet: cfg.sheet, row: payload });
        mutate((rs) => (rs ?? []).map((x) => (x.id === tmp ? { ...x, id: r.id, _pending: false } : x)));
        scheduleWarm();
      } catch (e) {
        mutate((rs) => (rs ?? []).filter((x) => x.id !== tmp));
        setNotice(errText(e));
      }
    } else {
      mutate((rs) => (rs ?? []).map((x) => (x.id === editId ? { ...x, ...payload } : x)));
      try {
        await call("adminUpsert", { sheet: cfg.sheet, row: { ...payload, id: editId } });
        scheduleWarm();
      } catch (e) {
        mutate(() => before ?? []);
        setNotice(errText(e));
      }
    }
  }

  function toggleActive(r: Row) {
    if (r._pending) return;
    const v = !r[cfg.activeKey];
    const set = (val: boolean) => mutate((rs) => (rs ?? []).map((x) => (x.id === r.id ? { ...x, [cfg.activeKey]: val } : x)));
    set(v);
    call("adminUpsert", { sheet: cfg.sheet, row: { id: r.id, [cfg.activeKey]: v } })
      .then(scheduleWarm)
      .catch((e) => { set(!v); setNotice(errText(e)); });
  }

  function remove(r: Row) {
    if (r._pending) return;
    if (!window.confirm("Rostdan ham o'chirilsinmi? Buni qaytarib bo'lmaydi. (Yashirish uchun o'chirgich tugmasidan foydalaning.)")) return;
    setNotice("");
    mutate((rs) => (rs ?? []).filter((x) => x.id !== r.id));
    call("adminDelete", { sheet: cfg.sheet, id: r.id })
      .then(scheduleWarm)
      .catch((e) => { setNotice(errText(e)); reload(); });
  }

  function move(i: number, dir: -1 | 1) {
    if (!rows) return;
    const j = i + dir;
    if (j < 0 || j >= rows.length || rows[i]._pending || rows[j]._pending) return;
    const next = rows.slice();
    [next[i], next[j]] = [next[j], next[i]];
    mutate(() => next);
    call("adminReorder", { sheet: cfg.sheet, ids: next.map((r) => r.id) })
      .then(scheduleWarm)
      .catch((e) => { setNotice(errText(e)); reload(); });
  }

  return (
    <div>
      <PageHeader
        title={cfg.title}
        hint={cfg.hint}
        actions={cfg.canCreate && <button className={btnPrimary} onClick={() => openForm(null)}>+ Qo'shish</button>}
      />
      {(notice || loadErr) && <div className="mb-4"><ErrorBox message={notice || loadErr} onRetry={reload} /></div>}
      {!rows ? (
        !loadErr && <Loading />
      ) : rows.length === 0 ? (
        <p className={`${cardCls} text-slate-500`}>Hozircha yozuv yo'q.</p>
      ) : (
        <>
        {/* Telefon va kichik planshet: har bir yozuv alohida karta */}
        <ul className="space-y-3 md:hidden">
          {rows.map((r, i) => {
            const photoCol = cfg.columns.find((c) => c.key === "photo_url");
            const titleCol = cfg.columns.find((c) => ["name", "full_name", "title", "question"].includes(c.key)) ?? cfg.columns.find((c) => c !== photoCol) ?? cfg.columns[0];
            const rest = cfg.columns.filter((c) => c !== photoCol && c !== titleCol);
            const show = (c: ColDef) => (c.render ? c.render(r, refs) : String(r[c.key] ?? ""));
            return (
              <li key={r.id} className={`rounded-2xl border border-slate-200 p-4 ${r[cfg.activeKey] ? "bg-white" : "bg-slate-50 text-slate-500"} ${r._pending ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-3">
                  {photoCol && <div className="shrink-0">{show(photoCol)}</div>}
                  <p className="min-w-0 flex-1 break-words text-base font-semibold leading-snug">{show(titleCol)}</p>
                </div>
                {rest.length > 0 && (
                  <dl className="mt-3 space-y-2 text-sm">
                    {rest.map((c) => (
                      <div key={c.key}>
                        <dt className="text-xs text-slate-500">{c.label}</dt>
                        <dd className="break-words">{show(c) || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <span className="text-sm text-slate-600">{cfg.activeLabel}</span>
                  <Toggle checked={!!r[cfg.activeKey]} onChange={() => toggleActive(r)} label={cfg.activeLabel} />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {cfg.ordered && (
                    <>
                      <button className={btnSmall} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Yuqoriga">↑</button>
                      <button className={btnSmall} onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Pastga">↓</button>
                    </>
                  )}
                  <div className="ml-auto flex gap-2">
                    <button className={btnSmall} onClick={() => !r._pending && openForm(r)} disabled={!!r._pending}>Tahrirlash</button>
                    <button className={btnDanger} onClick={() => remove(r)} disabled={!!r._pending}>O'chirish</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                {cfg.ordered && <th className="w-20 px-3 py-3">Tartib</th>}
                {cfg.columns.map((c) => <th key={c.key} className="px-3 py-3 font-medium">{c.label}</th>)}
                <th className="px-3 py-3 font-medium">{cfg.activeLabel}</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={r.id} className={`${r[cfg.activeKey] ? "" : "bg-slate-50 text-slate-500"} ${r._pending ? "opacity-60" : ""}`}>
                  {cfg.ordered && (
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button className={btnSmall} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Yuqoriga">↑</button>
                        <button className={btnSmall} onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Pastga">↓</button>
                      </div>
                    </td>
                  )}
                  {cfg.columns.map((c) => <td key={c.key} className="px-3 py-2 align-middle">{c.render ? c.render(r, refs) : String(r[c.key] ?? "")}</td>)}
                  <td className="px-3 py-2"><Toggle checked={!!r[cfg.activeKey]} onChange={() => toggleActive(r)} label={cfg.activeLabel} /></td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <button className={btnSmall} onClick={() => !r._pending && openForm(r)} disabled={!!r._pending}>Tahrirlash</button>
                      <button className={btnDanger} onClick={() => remove(r)} disabled={!!r._pending}>O'chirish</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {editing && (
        <Modal title={isNew ? `${cfg.singular}: yangi` : `${cfg.singular}: tahrirlash`} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            {cfg.fields.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                {f.type === "textarea" ? (
                  <textarea className={inputCls} rows={4} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                ) : f.type === "ref" ? (
                  <select className={inputCls} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                    <option value="">Tanlang</option>
                    {(refs[f.refSheet!] ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                ) : f.type === "bool" ? (
                  <Toggle checked={!!form[f.key]} onChange={(v) => setForm({ ...form, [f.key]: v })} label={f.label} />
                ) : f.type === "rating" ? (
                  <select className={inputCls} value={form[f.key] ?? 5} onChange={(e) => setForm({ ...form, [f.key]: Number(e.target.value) })}>
                    {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
                  </select>
                ) : f.type === "photo" ? (
                  <PhotoField value={form[f.key] ?? ""} onChange={(v) => setForm({ ...form, [f.key]: v })} />
                ) : (
                  <input className={inputCls} type={f.type === "number" ? "number" : "text"} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                )}
              </Field>
            ))}
            {formErr && <ErrorBox message={formErr} />}
            <div className="flex flex-col-reverse gap-2 pt-2 min-[420px]:flex-row min-[420px]:justify-end sm:gap-3 [&>button]:min-[420px]:min-w-28">
              <button className={btnGhost} onClick={() => setEditing(null)}>Bekor qilish</button>
              <button className={btnPrimary} onClick={save}>Saqlash</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
