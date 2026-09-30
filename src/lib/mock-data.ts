import type {
  Block,
  ChunkBody,
  LogLine,
  ProviderConfig,
  Release,
  RetrievedChunk,
  ScopeId,
  SourceDoc,
  StepKey,
  ThemeId,
} from "./types";

/* ── Knowledge base ──────────────────────────────────── */

export const DOCS: SourceDoc[] = [
  { id: "design", title: "آیین‌نامه طراحی ساختمان", short: "آیین‌نامه طراحی", category: "structure", chunks: 2410 },
  { id: "national", title: "مقررات ملی ساختمان", short: "مقررات ملی", category: "general", chunks: 5120 },
  { id: "n55", title: "نشریه ۵۵", short: "نشریه ۵۵", category: "execution", chunks: 1860 },
  { id: "n800", title: "نشریه ۸۰۰", short: "نشریه ۸۰۰", category: "execution", chunks: 940 },
  { id: "concrete", title: "آیین‌نامه بتن ایران", short: "آیین‌نامه بتن", category: "structure", chunks: 3270 },
  { id: "steel", title: "آیین‌نامه فولاد ایران", short: "آیین‌نامه فولاد", category: "structure", chunks: 2050 },
];

export const DEFAULT_SELECTED_DOCS = ["design", "national", "n55"];

export const CATEGORY_META: Record<SourceDoc["category"], { label: string; color: string }> = {
  structure: { label: "سازه", color: "bg-info" },
  general: { label: "عمومی", color: "bg-success" },
  execution: { label: "اجرا", color: "bg-warning" },
};

/* ── Retrieval depth ─────────────────────────────────── */

export const SCOPES: { id: ScopeId; label: string; k: number; description: string }[] = [
  { id: "quick", label: "سریع", k: 4, description: "پاسخ سریع و متمرکز" },
  { id: "standard", label: "استاندارد", k: 10, description: "تعادل دقت و سرعت — پیش‌فرض" },
  { id: "deep", label: "عمیق", k: 20, description: "تحلیل جامع‌تر · زمان پاسخ و مصرف توکن بیشتر" },
];

export const scopeById = (id: ScopeId) => SCOPES.find((s) => s.id === id)!;

/* ── Pipeline ────────────────────────────────────────── */

export const STEP_LABELS: Record<StepKey, { full: string; short: string }> = {
  understand: { full: "درک سوال", short: "درک سوال" },
  rewrite: { full: "بازنویسی و غنی‌سازی", short: "بازنویسی" },
  retrieve: { full: "بازیابی اسناد", short: "بازیابی اسناد" },
  compose: { full: "تدوین پاسخ", short: "تدوین پاسخ" },
};

export const STEP_ORDER: StepKey[] = ["understand", "rewrite", "retrieve", "compose"];

/* ── Themes ──────────────────────────────────────────── */

export const THEMES: { id: ThemeId; label: string; swatches: [string, string, string] }[] = [
  { id: "dark", label: "تیره", swatches: ["#10111c", "#1c1e2a", "#9184d9"] },
  { id: "light", label: "روشن", swatches: ["#f6f6f9", "#ffffff", "#6b5bd2"] },
  { id: "emerald", label: "زمردی", swatches: ["#111c1a", "#1b2a26", "#57b894"] },
  { id: "cyber", label: "سایبر", swatches: ["#0d1020", "#141a33", "#7fa8d9"] },
];

/* ── Retrieved chunks ────────────────────────────────── */

const H_MIN_FORMULA = ["h", { sub: "min" }, " = ( ℓ / 20 ) × ( 0.4 + f", { sub: "y" }, " / 700 )"];

type ChunkSeed = Omit<RetrievedChunk, "body" | "docShort" | "docTitle" | "chunkTotal" | "categoryLabel"> & {
  body?: ChunkBody[];
  section: string;
};

const docById = (id: string) => DOCS.find((d) => d.id === id)!;

const CATEGORY_LABEL: Record<string, string> = {
  design: "سازه · بارگذاری",
  national: "عمومی · مقررات",
  n55: "سازه · بتن",
  n800: "اجرا · کنترل",
  concrete: "سازه · بتن",
  steel: "سازه · فولاد",
};

const SEEDS: ChunkSeed[] = [
  {
    id: "chk_55_0412", docId: "n55", clause: "بند ۳-۲-۱", topic: "ضخامت دال",
    title: "حداقل ضخامت دال‌های یک‌طرفه", score: 0.92, chapter: "فصل ۳", page: 147, edition: "۱۴۰۲", tokens: 318, chunkIndex: 412,
    section: "۳-۲ ضخامت اعضای خمشی",
    excerpt: {
      before: "…ضخامت دال‌های یک‌طرفه که خیز آن‌ها محاسبه نمی‌شود نباید کمتر از مقادیر جدول ۳-۲ باشد.",
      highlight: "برای دال ساده‌تکیه‌گاهی، ضخامت حداقل برابر یک‌بیستم دهانه مؤثر و در هیچ حالت کمتر از ۱۰۰ میلی‌متر نخواهد بود.",
      after: "در صورتی که خیز محاسبه و کنترل شود، مقادیر کمتر با رعایت الزامات بند ۳-۵ مجاز است…",
    },
    body: [
      { type: "h", text: "۳-۲ ضخامت اعضای خمشی" },
      { type: "p", text: "ضخامت دال‌های یک‌طرفه که خیز آن‌ها محاسبه نمی‌شود نباید کمتر از مقادیر جدول ۳-۲ در نظر گرفته شود. این مقادیر برای بتن با وزن معمولی و فولاد با تنش تسلیم ۴۰۰ مگاپاسکال تدوین شده‌اند." },
      { type: "p", text: "برای دال ساده‌تکیه‌گاهی، ضخامت حداقل برابر یک‌بیستم دهانه مؤثر و در هیچ حالت کمتر از ۱۰۰ میلی‌متر نخواهد بود.", highlight: true },
      { type: "formula", expr: [...H_MIN_FORMULA, " ≥ 100 mm"] },
      { type: "p", text: "در صورتی که خیز عضو محاسبه و مطابق بند ۳-۵ کنترل شود، استفاده از ضخامت کمتر مجاز است، مشروط بر آنکه خیز بلندمدت از حدود مجاز جدول ۳-۶ فراتر نرود." },
      { type: "h", text: "۳-۲-۱-۱ ملاحظات اجرایی" },
      { type: "p", text: "در دال‌هایی که به‌عنوان دیافراگم عمل می‌کنند یا میزبان تأسیسات توکار هستند، ضخامت باید علاوه بر الزامات این بند، پوشش لازم روی میلگرد و لوله‌های توکار را نیز تأمین کند." },
    ],
  },
  {
    id: "chk_800_0188", docId: "n800", clause: "بند ۴-۱", topic: "کنترل خیز",
    title: "کنترل خیز دال‌های دوطرفه", score: 0.87, chapter: "فصل ۴", page: 63, edition: "۱۴۰۱", tokens: 284, chunkIndex: 188,
    section: "۴-۱ کنترل خیز",
    excerpt: {
      before: "…در دال‌های دوطرفه، نسبت دهانه بلند به کوتاه تعیین‌کننده رفتار خمشی است.",
      highlight: "ضخامت دال دوطرفه بدون محاسبه خیز نباید کمتر از یک‌بیست‌وهشتم دهانه آزاد و ۱۲۰ میلی‌متر باشد.",
      after: "برای دال‌های با تیر لبه سخت، مقدار نسبت تا یک‌سی‌وسوم قابل کاهش است…",
    },
  },
  {
    id: "chk_con_1204", docId: "concrete", clause: "بند ۹-۵-۲", topic: "پوشش بتن",
    title: "پوشش بتنی و ضخامت حداقل", score: 0.74, chapter: "فصل ۹", page: 212, edition: "۱۴۰۰", tokens: 301, chunkIndex: 1204,
    section: "۹-۵ پوشش بتن روی میلگرد",
    excerpt: {
      before: "…پوشش بتن روی میلگردها باید با توجه به شرایط محیطی تعیین شود.",
      highlight: "ضخامت دال طره‌ای باید دست‌کم یک‌دهم طول طره و نه کمتر از ۱۲۰ میلی‌متر باشد.",
      after: "در شرایط محیطی شدید، پوشش حداقل ۲۰ میلی‌متر افزایش می‌یابد…",
    },
  },
  {
    id: "chk_nat_2210", docId: "national", clause: "مبحث ۹ · بند ۹-۱۴", topic: "",
    title: "الزامات کلی دال‌ها", score: 0.68, chapter: "مبحث ۹", page: 318, edition: "۱۴۰۱", tokens: 356, chunkIndex: 2210,
    section: "۹-۱۴ سیستم‌های دال",
    excerpt: {
      before: "…سیستم‌های دال باید برای بارهای وارده و محدودیت‌های بهره‌برداری طراحی شوند.",
      highlight: "در صورت عدم محاسبه خیز، رعایت حداقل ضخامت‌های جدول ۹-۱۴-۱ الزامی است.",
      after: "این جدول برای بتن معمولی با چگالی ۲۴۰۰ کیلوگرم بر مترمکعب معتبر است…",
    },
  },
  {
    id: "chk_55_0415", docId: "n55", clause: "بند ۳-۲-۳", topic: "ضریب اصلاح فولاد",
    title: "اصلاح ضخامت برای تنش تسلیم غیراستاندارد", score: 0.66, chapter: "فصل ۳", page: 149, edition: "۱۴۰۲", tokens: 242, chunkIndex: 415,
    section: "۳-۲-۳ ضریب اصلاح",
    excerpt: {
      before: "…مقادیر جدول ۳-۲ برای فولاد با تنش تسلیم ۴۰۰ مگاپاسکال است.",
      highlight: "برای سایر فولادها، مقادیر جدول در ضریب (۰٫۴ + fy/۷۰۰) ضرب می‌شوند.",
      after: "این ضریب برای بتن سبک نیز با اصلاح چگالی قابل استفاده است…",
    },
  },
  {
    id: "chk_55_0690", docId: "n55", clause: "بند ۵-۴", topic: "مقاومت در برابر آتش",
    title: "ضخامت لازم برای مقاومت در برابر آتش", score: 0.63, chapter: "فصل ۵", page: 231, edition: "۱۴۰۲", tokens: 270, chunkIndex: 690,
    section: "۵-۴ الزامات حریق",
    excerpt: {
      before: "…دال‌ها باید برای مدت مقاومت در برابر آتش مورد نیاز طراحی شوند.",
      highlight: "برای مقاومت دوساعته، ضخامت مؤثر دال نباید کمتر از ۱۲۰ میلی‌متر باشد.",
      after: "پوشش‌های محافظ می‌توانند جایگزین بخشی از ضخامت شوند…",
    },
  },
  {
    id: "chk_des_0321", docId: "design", clause: "بند ۲-۶-۱", topic: "بار زنده",
    title: "بارهای زنده متعارف", score: 0.61, chapter: "فصل ۲", page: 58, edition: "۱۴۰۰", tokens: 228, chunkIndex: 321,
    section: "۲-۶ بار زنده",
    excerpt: {
      before: "…بار زنده کف‌ها بر اساس کاربری تعیین می‌شود.",
      highlight: "برای کاربری مسکونی، بار زنده گسترده ۲ کیلونیوتن بر مترمربع در نظر گرفته می‌شود.",
      after: "بارهای متمرکز باید جداگانه کنترل شوند…",
    },
  },
  {
    id: "chk_800_0197", docId: "n800", clause: "بند ۴-۳", topic: "خیز بلندمدت",
    title: "خیز بلندمدت و خزش", score: 0.59, chapter: "فصل ۴", page: 71, edition: "۱۴۰۱", tokens: 262, chunkIndex: 197,
    section: "۴-۳ خیز بلندمدت",
    excerpt: {
      before: "…اثرات خزش و جمع‌شدگی در خیز بلندمدت منظور می‌شود.",
      highlight: "ضریب خیز بلندمدت برای بارهای پایدار بیش از پنج سال برابر ۲ است.",
      after: "وجود میلگرد فشاری این ضریب را کاهش می‌دهد…",
    },
  },
  {
    id: "chk_con_1188", docId: "concrete", clause: "بند ۹-۳-۱", topic: "دال دوطرفه",
    title: "دال‌های دوطرفه بدون تیر", score: 0.58, chapter: "فصل ۹", page: 204, edition: "۱۴۰۰", tokens: 290, chunkIndex: 1188,
    section: "۹-۳ دال‌های دوطرفه",
    excerpt: {
      before: "…در دال‌های تخت بدون تیر، برش پانچ کنترل‌کننده است.",
      highlight: "حداقل ضخامت دال تخت بدون کتیبه ۱۲۵ میلی‌متر است.",
      after: "استفاده از کتیبه ستون این مقدار را به ۱۰۰ میلی‌متر کاهش می‌دهد…",
    },
  },
  {
    id: "chk_55_0413", docId: "n55", clause: "بند ۳-۲-۲", topic: "دال گیردار",
    title: "دال یک‌طرفه با دو انتهای پیوسته", score: 0.56, chapter: "فصل ۳", page: 148, edition: "۱۴۰۲", tokens: 236, chunkIndex: 413,
    section: "۳-۲-۲ دال پیوسته",
    excerpt: {
      before: "…پیوستگی دال در تکیه‌گاه‌ها خیز را کاهش می‌دهد.",
      highlight: "برای دال با دو انتهای پیوسته، حداقل ضخامت یک‌بیست‌وهشتم دهانه است.",
      after: "برای یک انتهای پیوسته از نسبت یک‌بیست‌وچهارم استفاده شود…",
    },
  },
  // lower-ranked chunks, used by the «عمیق» scope
  ...(
    [
      ["chk_st_0802", "steel", "بند ۱۰-۲-۴", "دال مختلط", 0.54, 212],
      ["chk_nat_2231", "national", "مبحث ۹ · بند ۹-۱۶", "", 0.53, 327],
      ["chk_des_0340", "design", "بند ۲-۷-۲", "ارتعاش کف", 0.51, 64],
      ["chk_con_1302", "concrete", "بند ۱۰-۱-۳", "تیرچه و بلوک", 0.5, 238],
      ["chk_800_0240", "n800", "بند ۵-۲", "تحمل‌پذیری اجرا", 0.48, 88],
      ["chk_55_0730", "n55", "بند ۶-۱", "جزئیات آرماتوربندی", 0.47, 250],
      ["chk_st_0815", "steel", "بند ۱۰-۳-۱", "عرشه فولادی", 0.45, 219],
      ["chk_nat_2302", "national", "مبحث ۹ · بند ۹-۲۰", "", 0.44, 351],
      ["chk_con_1411", "concrete", "بند ۱۲-۲", "دوام بتن", 0.42, 266],
      ["chk_des_0402", "design", "بند ۳-۱-۱", "بار مرده", 0.41, 81],
    ] as const
  ).map(([id, docId, clause, topic, score, page], i): ChunkSeed => ({
    id, docId, clause, topic, score, page,
    title: topic || "الزامات تکمیلی",
    chapter: `فصل ${clause.split(" ").pop()!.split("-")[0]}`,
    edition: "۱۴۰۱", tokens: 210 + i * 7, chunkIndex: 500 + i * 37,
    section: `${clause.replace("بند ", "")} ${topic || "الزامات تکمیلی"}`,
    excerpt: {
      before: "…این بند الزامات تکمیلی مرتبط با ضخامت و رفتار دال را بیان می‌کند.",
      highlight: `رعایت ضوابط ${topic || "این مبحث"} در کنار حداقل ضخامت‌های فصل مربوط الزامی است.`,
      after: "جزئیات بیشتر در پیوست‌های سند ارائه شده است…",
    },
  })),
];

export const ALL_CHUNKS: RetrievedChunk[] = SEEDS.map(({ section, body, ...seed }) => {
  const doc = docById(seed.docId);
  return {
    ...seed,
    docShort: doc.short,
    docTitle: doc.title,
    chunkTotal: doc.chunks,
    categoryLabel: CATEGORY_LABEL[seed.docId],
    body: body ?? [
      { type: "h", text: section },
      { type: "p", text: seed.excerpt.before.replace(/^…/, "") },
      { type: "p", text: seed.excerpt.highlight, highlight: true },
      { type: "p", text: seed.excerpt.after.replace(/…$/, ".") },
    ],
  };
});

export const chunkById = (id: string) => ALL_CHUNKS.find((c) => c.id === id);

/* ── Sample answer ───────────────────────────────────── */

const cite = (id: string) => ({ cite: id, label: chunkById(id)!.clause.replace(/^.*· /, "") });

export const SLAB_ANSWER: Block[] = [
  {
    type: "p",
    content: [
      "حداقل ضخامت دال بتنی یک مقدار ثابت نیست و تابع ",
      { b: "نوع دال، شرایط تکیه‌گاهی و دهانه مؤثر" },
      " است. در شرایط معمول — بار زنده متعارف، بدون کنترل مستقل خیز — مقادیر زیر به‌عنوان کف طراحی پذیرفته می‌شوند. ",
      cite("chk_55_0412"),
    ],
  },
  {
    type: "ul",
    items: [
      ["دال یک‌طرفه با تکیه‌گاه ساده: ", { b: "ℓ⁄۲۰" }, " و نه کمتر از ", { b: "۱۰۰ میلی‌متر" }, " ", cite("chk_55_0412")],
      ["دال دوطرفه: ", { b: "ℓ⁄۲۸" }, " و نه کمتر از ", { b: "۱۲۰ میلی‌متر" }, " ", cite("chk_800_0188")],
      ["دال طره‌ای: ", { b: "ℓ⁄۱۰" }, " با کنترل خیز بلندمدت الزامی"],
    ],
  },
  {
    type: "table",
    caption: "جدول ۱ · ضخامت حداقل",
    head: ["نوع دال", "نسبت ضخامت", "حداقل مطلق", "مرجع"],
    rows: [
      ["یک‌طرفه · تکیه‌گاه ساده", "ℓ / 20", "۱۰۰ میلی‌متر", "نشریه ۵۵ — بند ۳-۲-۱"],
      ["یک‌طرفه · دو سر گیردار", "ℓ / 28", "۱۰۰ میلی‌متر", "نشریه ۵۵ — بند ۳-۲-۲"],
      ["دوطرفه", "ℓ / 28 … ℓ / 33", "۱۲۰ میلی‌متر", "نشریه ۸۰۰ — بند ۴-۱"],
      ["طره‌ای", "ℓ / 10", "۱۲۰ میلی‌متر", "آیین‌نامه بتن — بند ۹-۵-۲"],
    ],
    mono: [1],
    muted: [3],
    rowCites: ["chk_55_0412", "chk_55_0413", "chk_800_0188", "chk_con_1204"],
  },
  {
    type: "p",
    content: [
      "در صورت استفاده از فولاد با تنش تسلیم غیر از ۴۰۰ مگاپاسکال، مقدار پایه با ضریب اصلاح زیر تصحیح می‌شود: ",
      cite("chk_55_0415"),
    ],
  },
  {
    type: "formula",
    expr: H_MIN_FORMULA,
    legend: [
      { sym: ["ℓ"], desc: "دهانه مؤثر (mm)" },
      { sym: ["f", { sub: "y" }], desc: "تنش تسلیم فولاد (MPa)" },
    ],
  },
  {
    type: "callout",
    tone: "warning",
    content: [
      "در حضور بارهای دینامیکی، الزامات مقاومت در برابر آتش یا پوشش‌های خاص، ضخامت به‌دست‌آمده کافی نیست و باید مطابق بند ۵-۴ افزایش یابد. ",
      cite("chk_55_0690"),
    ],
  },
];

export const SAMPLE_QUESTIONS = [
  "حداقل ضخامت دال بتنی در شرایط معمول بر اساس آیین‌نامه چقدر باید باشد؟",
  "برای دال دوطرفه، کنترل خیز بر اساس کدام بند انجام می‌شود؟",
  "متن کامل بند ۳-۲-۱ نشریه ۵۵ درباره ضخامت دال چیست؟",
];

/* ── AI providers ────────────────────────────────────── */

export const PROVIDERS: ProviderConfig[] = [
  {
    slot: "primary",
    provider: "OpenAI",
    description: "دسترسی مستقیم به API رسمی؛ مناسب محیط عملیاتی با نیاز به پایداری بالا.",
    host: "api.openai.com",
    apiKey: "sk-proj-demo-a8Qe71LmZr0Tx4f2a",
    baseUrl: "https://api.openai.com/v1",
    baseUrlRequired: false,
    models: [
      { id: "gpt-5", ctx: "128k ctx" },
      { id: "gpt-5-mini", ctx: "128k ctx" },
      { id: "gpt-4.1", ctx: "1M ctx" },
    ],
    model: "gpt-5",
    customModel: "",
    lastValidated: "امروز ۱۴:۱۸",
    health: "connected",
  },
  {
    slot: "gateway",
    provider: "Anthropic",
    description: "دسترسی از طریق سرور واسط سازمانی؛ مناسب شبکه‌های با محدودیت دسترسی مستقیم.",
    host: "gateway.internal",
    apiKey: "",
    baseUrl: "https://gateway.internal/anthropic/v1",
    baseUrlRequired: true,
    models: [
      { id: "claude-sonnet-5", ctx: "200k ctx" },
      { id: "claude-opus-5-5", ctx: "200k ctx" },
      { id: "claude-haiku-4-5", ctx: "200k ctx" },
    ],
    model: "claude-sonnet-5",
    customModel: "",
    health: "idle",
  },
  {
    slot: "custom",
    provider: "Self-hosted",
    description: "سرور سازگار با OpenAI (vLLM، Ollama و…) در شبکه داخلی؛ داده از سازمان خارج نمی‌شود.",
    host: "llm.local:8000",
    apiKey: "",
    baseUrl: "http://llm.local:8000/v1",
    baseUrlRequired: true,
    models: [
      { id: "qwen3-32b-instruct", ctx: "32k ctx" },
      { id: "llama-4-scout", ctx: "128k ctx" },
    ],
    model: "qwen3-32b-instruct",
    customModel: "",
    lastValidated: "دیروز ۱۱:۰۲",
    health: "degraded",
  },
];

export const SLOT_LABELS: Record<ProviderConfig["slot"], string> = {
  primary: "سرویس اصلی",
  gateway: "سرویس واسط",
  custom: "سرور سفارشی",
};

const MODEL_DISPLAY: Record<string, string> = {
  "gpt-5": "GPT-5",
  "gpt-5-mini": "GPT-5 mini",
  "gpt-4.1": "GPT-4.1",
  "claude-sonnet-5": "Claude Sonnet 5",
  "claude-opus-5-5": "Claude Opus 5.5",
  "claude-haiku-4-5": "Claude Haiku 4.5",
};

export const modelName = (id: string) => MODEL_DISPLAY[id] ?? id;

export function modelDisplay(p: ProviderConfig): string {
  return modelName(p.customModel.trim() || p.model);
}

/* ── Telemetry ───────────────────────────────────────── */

export const INITIAL_LOGS: LogLine[] = [
  { id: "l1", ts: "14:23:01.204", level: "INFO", service: "api.gateway", message: "POST /v1/ask · user u_2841 · scope=standard" },
  { id: "l2", ts: "14:23:01.318", level: "INFO", service: "rag.rewriter", message: "query expanded · terms=7 · 114ms" },
  { id: "l3", ts: "14:23:01.960", level: "INFO", service: "rag.retriever", message: "top_k=10 · sources=[n55,n800,concrete] · 642ms" },
  { id: "l4", ts: "14:23:02.005", level: "WARN", service: "rag.reranker", message: "2 chunks below threshold 0.55 · dropped" },
  { id: "l5", ts: "14:23:02.812", level: "INFO", service: "llm.openai", message: "gpt-5 stream complete · 2140 tok · 1.81s" },
  { id: "l6", ts: "14:23:07.144", level: "ERROR", service: "rag.retriever", message: "RetrievalTimeout · req_8f42c1ad · 8000ms · attempts 2/2" },
  { id: "l7", ts: "14:23:07.150", level: "ERROR", service: "vector.pg", message: "connection pool exhausted (20/20) · waiting 4" },
  { id: "l8", ts: "14:23:08.002", level: "WARN", service: "vector.pg", message: "pool resized 20 → 32 · recovering" },
  { id: "l9", ts: "14:23:09.417", level: "INFO", service: "vector.pg", message: "healthy · idx=hnsw · 9390 vectors · 12ms" },
  { id: "l10", ts: "14:23:11.088", level: "INFO", service: "auth.session", message: "token refreshed · u_2841 · ttl=3600s" },
  { id: "l11", ts: "14:23:14.630", level: "INFO", service: "index.worker", message: "chunked doc n800 · 940 chunks · embed queued" },
  { id: "l12", ts: "14:23:15.002", level: "DEBUG", service: "cache.answer", message: "miss · key=sha1:4d9c…e18" },
];

export const TAIL_TEMPLATES: Omit<LogLine, "id" | "ts">[] = [
  { level: "INFO", service: "vector.pg", message: "healthy · idx=hnsw · 9390 vectors · 11ms" },
  { level: "INFO", service: "api.gateway", message: "GET /v1/health · 200 · 3ms" },
  { level: "DEBUG", service: "cache.answer", message: "hit · key=sha1:91ab…c07" },
  { level: "INFO", service: "auth.session", message: "session opened · u_3107 · ttl=3600s" },
  { level: "INFO", service: "index.worker", message: "embed batch done · 64 chunks · 1.2s" },
  { level: "WARN", service: "rag.reranker", message: "1 chunk below threshold 0.55 · dropped" },
];

export const RELEASES: Release[] = [
  {
    version: "v1.4.0",
    badge: "latest",
    date: "۱۴۰۵/۰۶/۱۱",
    items: [
      { kind: "new", text: "بازرس قطعه سند با نمایش امتیاز مرتبط‌بودن و متن اصلی" },
      { kind: "new", text: "انتخابگر عمق جستجو (سریع / استاندارد / عمیق)" },
      { kind: "improve", text: "۳۰٪ کاهش تأخیر بازیابی با ایندکس HNSW" },
      { kind: "fix", text: "اصلاح جهت اعداد لاتین در جدول‌های پاسخ" },
    ],
  },
  {
    version: "v1.3.2",
    badge: "stable",
    date: "۱۴۰۵/۰۵/۲۸",
    items: [
      { kind: "improve", text: "پایداری اتصال به سرویس واسط و تلاش مجدد خودکار" },
      { kind: "fix", text: "خطای نمایش نشان ارجاع در انتهای پاراگراف" },
    ],
  },
  {
    version: "v1.3.0",
    badge: "demo",
    date: "۱۴۰۵/۰۵/۰۹",
    items: [{ kind: "new", text: "نخستین انتشار میزکار پاسخ‌گویی مبتنی بر اسناد" }],
  },
];

export const APP_VERSION = "v1.4.0";

/* ── Conversation history (sidebar) ─────────────────── */

export const CHAT_HISTORY: { id: string; title: string; when: string }[] = [
  { id: "h1", title: "پوشش بتن روی میلگرد در محیط مرطوب", when: "دیروز" },
  { id: "h2", title: "ضوابط اتصال جوشی تیر به ستون", when: "۳ روز" },
  { id: "h3", title: "فاصله حداکثر خاموت در ناحیه بحرانی", when: "هفته پیش" },
];
