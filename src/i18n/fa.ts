/** Persian (Farsi) catalog. UI chrome here; teaching copy (levels, series
 *  titles, deep lessons) comes from the fa-gN group files. dir: rtl.
 */

import type { Catalog } from './types';
import { faG1 } from './fa-g1';
import { faG2 } from './fa-g2';
import { faG3 } from './fa-g3';
import { faG4 } from './fa-g4';
import { faG5 } from './fa-g5';

export const fa: Catalog = {
  locale: 'fa',
  dir: 'rtl',
  ui: {
    menuLabel: 'منو',
    language: 'زبان',
    levels: 'مراحل',
    lesson: 'درس',
    lessonTitle: 'پخش دوباره‌ی درس این مرحله',
    guide: 'راهنما',
    hint: 'راهنمایی',
    solution: 'راه‌حل',
    undo: 'واگرد',
    reset: 'بازنشانی',
    sandboxBtn: 'ساندباکس',
    help: 'کمک',
    visitorsTitle: 'بازدیدگران منحصربه‌فرد',
    githubTitle: 'مخزن GitHub',
    support: 'حمایت',
    supportTitle: 'برایم قهوه بخر',
    titleLine: (idx, name) => `مرحله ${idx} · ${name}`,
    sandboxTitle: 'ساندباکس',
    eliBands: {
      eli5: 'مبتدی',
      eli10: 'مقدماتی',
      eli15: 'متوسط',
      eli20: 'پیشرفته',
      eliphd: 'استاد',
    },

    sandboxWelcome: 'ساندباکس learnpython. عبارات Python بنویسید یا `help` را بزنید.',
    levelMeta: (name) => `مرحله: ${name}`,

    dockSandboxTitle: 'ساندباکس',
    dockSandboxObjective:
      'Python بنویسید تا گراف حافظه را تغییر دهید. نام‌ها روی stack می‌نشینند؛ اشیاء قابل‌تغییر در heap زندگی می‌کنند؛ و لبه‌های کهربایی ارجاعات (reference) هستند.',
    dockStartHere: 'از اینجا شروع کنید',
    dockStartHereItems: [
      '`a = [1]` — یک نام که به یک list در heap اشاره می‌کند',
      '`b = a` — دو نام، یک شیء (ایالیسینگ)',
      '`a.append(2)` — تغییر شیء مشترک در همان‌جا',
    ],
    dockNoActiveLevel: 'مرحله‌ای فعال نیست',
    dockNoActiveLevelDetail: 'برای شروع بررسی اهداف، یک مرحله از منو انتخاب کنید.',
    nextTitle: 'بعدی',
    allChecksPassed: 'همه‌ی بررسی‌ها پاس شدند.',
    tryLabel: 'تلاش کن',
    nowChip: 'اکنون',
    hintLabel: 'راهنمایی:',
    bestSoFar: (best, par) => `بهترین تا حالا: ${best} دستور · ایده‌آل: ${par}`,
    idealSolution: (par) => `راه‌حل ایده‌آل: ${par} دستور (کمتر یا برابر عالی است)`,
    youAreLearning: 'در حال یادگیری',
    fieldNotesTitle: 'در عمل (یادداشت‌های میدانی)',

    usageLevel: 'استفاده: level <id>   مثلاً level first-name',
    unknownLevel: (id) => `مرحله‌ی نامشخص: ${id}`,
    guideRight: 'راهنمای زنده همیشه در کنارتان است.',
    hintsLevelsOnly: 'راهنمایی‌ها فقط در حالت مراحل در دسترس است.',
    metaSolution: (s) => `راه‌حل:\n${s}`,
    nothingToUndo: 'چیزی برای واگرد نیست.',
    undid: 'آخرین عبارت واگرد شد.',
    envReset: 'محیط بازنشانی شد.',
    unknownCommand: (c) => `دستور ناشناخته: ${c}`,
    golf: (used, par) => `دستورها: ${used} · ایده‌آل: ${par}`,
    metaHint: (h) => `راهنمایی: ${h}`,

    levelsTitle: 'مراحل',
    levelsIntro:
      'یک چالش انتخاب کنید. تازه‌وارد هستید؟ از بالا شروع کنید — <strong>▶ Hello, world</strong> — و به سمت پایین ادامه دهید. درس از Python ساده تا مدل حافظه و سپس کتابخانه‌ها بالا می‌رود.',
    howToRead: 'چگونه بخوانید',
    legendPar: 'تعداد ایده‌آل دستورها',
    legendSolved: 'حل‌شده، بهترین تعداد دستور',
    legendDifficulty: 'سختی، ۱ تا ۵',
    legendStart: 'اگر تازه‌واردید از اینجا شروع کنید',
    deepLessonBtn: 'درس عمیق',
    deepLessonTitle: (title) => `خواندن درس کامل ${title} (Beginner→Master)`,
    close: 'بستن',
    closePrimary: 'بستن',

    whatThisTeaches: 'این چه چیزی یاد می‌دهد',
    inProduction: 'در عمل',
    hintColon: 'راهنمایی:',
    deepLessonAction: 'درس عمیق',
    deepLessonModalTitle: (title) => `${title} — درس عمیق`,

    uiGuideTitle: 'راهنمای رابط — هر بخش چه می‌کند',
    uiHelpMapTitle: 'نقشه‌ی صفحه — هر ناحیه چه کاری انجام می‌دهد',
    uiHelpCommands: 'دستورها: `help` · `levels` · `lesson` · `hint` · `solution` · `undo` · `reset`',
    highlightThis: 'نشان بده',
    useIt: 'نحوه‌ی استفاده:',
    helpSections: [
      {
        id: 'level-title',
        selector: '.level-title',
        title: 'نوارِ مرحله‌ی فعلی',
        what: 'شماره و نام مرحله‌ای که الان توشی رو نشون می‌ده، مثلا **مرحله ۱ · Hello, world**.',
        how: 'بخوانش تا مطمئن بشی کجا هستی.',
      },
      {
        id: 'menu',
        selector: '.nav-toggle',
        title: 'منو (≡)',
        what:
          'دکمه‌های عمل رو باز می‌کنه: **مراحل** (کل فهرست)، **درس** (پخش دوباره‌ی آموزشِ این مرحله)، **راهنما**، **راهنمایی**، **راه‌حل**، **واگرد**، **بازنشانی**، **ساندباکس** و **کمک** (همین راهنما).',
        how: 'برای دیدن دکمه‌ها بزن؛ **مراحل** کل نقشه‌ی دوره‌ست.',
      },
      {
        id: 'board',
        selector: '.board-tabs',
        title: 'تب‌های بوم — Memory / Plot / RAM',
        what:
          'سه لنز روی همین اجرا: **Memory** گراف زنده‌ی اشیاء (فریم‌های stack، heap، لبه‌های کهربایی ارجاع)، **RAM** نقشه‌ی حافظه (آدرس، بایت، refcount)، و **Plot** برای مراحل رسم.',
        how: 'با جابه‌جا شدن تب‌ها، همون داده رو از زاویه‌ی دیگر ببین.',
      },
      {
        id: 'canvas',
        selector: '.board-body',
        title: 'بوم (canvas)',
        what: 'جایی که پایتون جلوی چشم‌ات اجرا می‌شه: نام‌ها، اشیاء و ارجاعات بینشان، زنده رسم می‌شن.',
        how: 'بعد از هر استیتمنتی که می‌زنی، تغییرش رو ببین.',
      },
      {
        id: 'step',
        selector: '#step-bar',
        title: 'نوارِ مرحله‌به‌مرحله — دیدنِ حلقه',
        what: 'بعد از اجرا، با ⏮ ◀ ▶ ⏭ برنامه رو قدم‌به‌قدم روی بوم بازپخش کن.',
        how: 'توی مراحل حلقه، چرخش `for` / `while` رو روی داده ببین.',
      },
      {
        id: 'terminal',
        selector: '#terminal',
        title: 'کنسول',
        what:
          'پایتون رو اینجا تایپ کن و **Enter** بزن. **Tab** تکمیل می‌کنه؛ کنسول دستوراتِ ویژه مثل `levels`, `hint`, `solution`, `undo`, `reset` رو هم می‌گیره.',
        how: 'همین‌جاست که واقعاً مرحله رو حل می‌کنی.',
      },
      {
        id: 'dock',
        selector: '.dock',
        title: 'پنل راهنما (راست، همیشگی)',
        what:
          'مربیِ زنده: چه چیزی یاد می‌گیری، یادداشت‌های میدانی، تعداد ایده‌آل دستورها، و چک‌لیستِ گام‌به‌گام با گامِ فعلیِ برجسته‌شده.',
        how: 'هنگام تایپ نگهش دار؛ وقتی گیر کردی **راهنمایی** کمک می‌کنه.',
      },
      {
        id: 'links',
        selector: 'a.tb-link',
        title: 'GitHub و حمایت',
        what: 'مخزنِ سورس و صفحه‌ی Buy-Me-A-Coffee برای ناشر.',
        how: 'هر دو در تب جدید باز می‌شن.',
      },
    ],

    welcomeTitle: 'به learnpython خوش آمدید',
    welcomeBody: `Python را **از صفر** یاد بگیرید — قدم‌به‌قدم کوچک — و کار کردنش را ببینید.

دقیقاً از همان‌جا شروع می‌کنید که هر برنامه‌ی Python شروع می‌کند: \`print("Hello, world!")\`. سپس یک مقدار ذخیره می‌کنید، حسابی کوچک می‌کنید، با \`if\` تصمیم می‌گیرید و یک بلوک را با \`for\` تکرار می‌کنید. هیچ پیش‌نیازی از Python لازم نیست.

فقط وقتی که بتوانید Python واقعی بنویسید، درس نشان می‌دهد *که کامپیوتر داده‌های شما را چطور نگه می‌دارد* — نام‌ها، اشیاء و ارجاعات بینشان، که زنده روی بوم **Memory** رسم می‌شوند.

- **تب Memory** — گراف زنده‌ی اشیاء (فریم‌های stack، اشیاء heap، و لبه‌های کهربایی ارجاع).
- **تب Plot** — برای مراحل plot.
- **داک** — راهنمای همیشگی با یک چک‌لیست برای هر بررسی.
- **نوار مرحله‌به‌مرحله** — بعد از اجرا، با ⏮ ◀ ▶ ⏭ در اجرا جابه‌جا شوید تا یک *حلقه* را قدم‌به‌قدم ببینید.
`,
    sandboxAction: 'ساندباکس',
    openLevelsAction: 'باز کردن مراحل',

    okLevelComplete: (golf) => `مرحله کامل شد — ${golf}.`,
    golfOnPar: 'در حد ایده‌آل یا کمتر',
    golfStatements: (n, par) => `${n} دستور (ایده‌آل ${par})`,
    celebrateTitle: 'مرحله کامل شد',
    celebrateBadge: 'مرحله تمام',
    celebrateNext: (name) => `بعدی: **${name}**`,
    celebrateEnd: 'به انتهای این بسته رسیدید.',
    celebrateStats: (n, par) => `${n} دستور · ایده‌آل ${par}`,
    keepGoing: 'ادامه بده',
    nextAction: (name) => `بعدی: ${name}`,
    browseLevels: 'مشاهده‌ی مراحل',
  },
  seriesTitles: { ...faG1.seriesTitles, ...faG2.seriesTitles, ...faG3.seriesTitles, ...faG4.seriesTitles, ...faG5.seriesTitles },
  deepLessons: { ...faG1.deepLessons, ...faG2.deepLessons, ...faG3.deepLessons, ...faG4.deepLessons, ...faG5.deepLessons },
  levels: { ...faG1.levels, ...faG2.levels, ...faG3.levels, ...faG4.levels, ...faG5.levels },
};
