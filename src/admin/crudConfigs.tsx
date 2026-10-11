import type { CrudConfig } from "./CrudPage";
import { photoPreview } from "./CrudPage";

const cut = (s: unknown, n = 70) => { const t = String(s ?? ""); return t.length > n ? t.slice(0, n) + "…" : t; };
const base = { activeKey: "active" as const, activeLabel: "Saytda ko'rinadi", ordered: true, canCreate: true };

export const courses: CrudConfig = {
  ...base, sheet: "Courses", required: ['name'], title: "Kurslar", singular: "Kurs",
  hint: "Kurs — fan (masalan, Turk tili). Guruhlar alohida bo'limda boshqariladi.",
  columns: [{ key: "name", label: "Nomi" }, { key: "description", label: "Tavsif", render: (r) => cut(r.description) }],
  fields: [
    { key: "name", label: "Nomi", type: "text" },
    { key: "description", label: "Tavsif", type: "textarea" },
    { key: "active", label: "Saytda ko'rinadi", type: "bool" },
  ],
};

export const groups: CrudConfig = {
  ...base, sheet: "Groups", required: ['course_id', 'name'], title: "Guruhlar", singular: "Guruh",
  hint: "Guruh — kurs ichidagi daraja yoki dastur (masalan, A1–A2).",
  columns: [
    { key: "course_id", label: "Kurs", render: (r, refs) => refs.Courses?.find((c) => c.id === r.course_id)?.name ?? "—" },
    { key: "name", label: "Guruh" },
    { key: "schedule", label: "Jadval" },
  ],
  fields: [
    { key: "course_id", label: "Kurs", type: "ref", refSheet: "Courses" },
    { key: "name", label: "Guruh nomi", type: "text" },
    { key: "description", label: "Tavsif", type: "textarea" },
    { key: "schedule", label: "Jadval", type: "text", hint: "Masalan: Haftada 3 marta, 90 daqiqa" },
    { key: "active", label: "Saytda ko'rinadi", type: "bool" },
  ],
};

export const teachers: CrudConfig = {
  ...base, sheet: "Teachers", required: ['full_name'], title: "O'qituvchilar", singular: "O'qituvchi",
  hint: "Rasm brauzerda tik to'rtburchak (4:5) shaklda qirqilib, siqiladi va Google Drive'ga yuklanadi. Saytda karta ochilganda \"Batafsil ma'lumot\" ko'rinadi.",
  columns: [
    { key: "photo_url", label: "Rasm", render: (r) => r.photo_url ? <img src={photoPreview(r.photo_url)} alt="" referrerPolicy="no-referrer" className="h-14 w-11 rounded-md bg-slate-100 object-cover object-top" /> : <span className="text-slate-400">—</span> },
    { key: "full_name", label: "F.I.Sh." },
    { key: "position", label: "Qisqa izoh" },
  ],
  fields: [
    { key: "photo_url", label: "Rasm", type: "photo" },
    { key: "full_name", label: "F.I.Sh.", type: "text" },
    { key: "position", label: "Qisqa izoh (rasm tagida ko'rinadi)", type: "text", hint: "Masalan: Turk tili o'qituvchisi" },
    { key: "bio", label: "Batafsil ma'lumot", type: "textarea", hint: "\"Batafsil\" tugmasi bosilganda kartada ochiladi. Bo'sh qoldirsangiz, tugma ko'rinmaydi. Yangi qator ham saqlanadi." },
    { key: "active", label: "Saytda ko'rinadi", type: "bool" },
  ],
};

export const formats: CrudConfig = {
  ...base, sheet: "Formats", required: ['name'], title: "Ta'lim formatlari", singular: "Format",
  columns: [{ key: "name", label: "Nomi" }, { key: "description", label: "Tavsif", render: (r) => cut(r.description) }],
  fields: [
    { key: "name", label: "Nomi", type: "text", hint: "Masalan: Offline, Online" },
    { key: "description", label: "Tavsif", type: "textarea" },
    { key: "active", label: "Saytda ko'rinadi", type: "bool" },
  ],
};

export const advantages: CrudConfig = {
  ...base, sheet: "Advantages", required: ['title'], title: "Nega ApexEdu (afzalliklar)", singular: "Afzallik",
  columns: [{ key: "title", label: "Sarlavha" }, { key: "text", label: "Matn", render: (r) => cut(r.text) }],
  fields: [
    { key: "title", label: "Sarlavha", type: "text" },
    { key: "text", label: "Matn", type: "textarea" },
    { key: "active", label: "Saytda ko'rinadi", type: "bool" },
  ],
};

export const testimonials: CrudConfig = {
  ...base, sheet: "Testimonials", required: ['name', 'text'], title: "Talabalar natijalari", singular: "Natija",
  columns: [{ key: "name", label: "Ism" }, { key: "result", label: "Natija" }, { key: "text", label: "Matn", render: (r) => cut(r.text, 50) }],
  fields: [
    { key: "name", label: "Ism", type: "text" },
    { key: "result", label: "Natija", type: "text", hint: "Masalan: B1 darajasi, 6 oyda" },
    { key: "text", label: "Matn", type: "textarea" },
    { key: "active", label: "Saytda ko'rinadi", type: "bool" },
  ],
};

export const faq: CrudConfig = {
  ...base, sheet: "FAQ", required: ['question', 'answer'], title: "Ko'p so'raladigan savollar", singular: "Savol",
  columns: [{ key: "question", label: "Savol" }, { key: "answer", label: "Javob", render: (r) => cut(r.answer, 60) }],
  fields: [
    { key: "question", label: "Savol", type: "text" },
    { key: "answer", label: "Javob", type: "textarea" },
    { key: "active", label: "Saytda ko'rinadi", type: "bool" },
  ],
};

export const heroCards: CrudConfig = {
  ...base, sheet: "HeroCards", required: ['title', 'course_id'], title: "Bosh sahifa kartasi", singular: "Slayd",
  hint: "Bosh sahifadagi \"daraja yo'li\" kartasi: har bir slayd tanlangan kursning faol guruhlarini avtomatik ko'rsatadi. Slaydlar navbat bilan almashadi.",
  columns: [
    { key: "title", label: "Sarlavha" },
    { key: "course_id", label: "Kurs", render: (r, refs) => refs.Courses?.find((c) => c.id === r.course_id)?.name ?? "—" },
  ],
  fields: [
    { key: "title", label: "Sarlavha", type: "text", hint: "Masalan: Turk tili: daraja yo'li" },
    { key: "course_id", label: "Qaysi kurs guruhlari ko'rsatilsin", type: "ref", refSheet: "Courses" },
    { key: "active", label: "Saytda ko'rinadi", type: "bool" },
  ],
};

export const reviews: CrudConfig = {
  sheet: "Reviews", required: ['name', 'text'], title: "Fikrlar", singular: "Fikr", activeKey: "approved", activeLabel: "Saytda ko'rinadi (tasdiqlangan)",
  hint: "Saytdan kelgan fikrlar avval tasdiqlanmagan holda tushadi. Faqat tasdiqlanganlari saytda ko'rinadi.",
  ordered: false, canCreate: false,
  columns: [
    { key: "created_at", label: "Sana", render: (r) => String(r.created_at).slice(0, 10) },
    { key: "name", label: "Ism" },
    { key: "rating", label: "Baho", render: (r) => <span className="text-amber-500">{"★".repeat(r.rating)}</span> },
    { key: "text", label: "Fikr", render: (r) => cut(r.text, 70) },
  ],
  fields: [
    { key: "name", label: "Ism", type: "text" },
    { key: "rating", label: "Baho", type: "rating" },
    { key: "text", label: "Fikr", type: "textarea" },
    { key: "approved", label: "Saytda ko'rinadi", type: "bool" },
  ],
};
