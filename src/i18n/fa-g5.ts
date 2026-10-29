import type { LevelGroup } from './types';

export const faG5: LevelGroup = {
  seriesTitles: {
    asyncio: 'Asyncio: coroutine‌ها، task‌ها و event loop',
    threading: 'Threading: thread‌ها، وضعیت مشترک و data race',
  },
  deepLessons: {
    asyncio: `## Beginner

فکر کنید **دو نفر و یک اجاق**. هرکدام یک دستور پخت دارد که می‌گوید «کمی بپز، بعد صبر کن تا آب بجوشد، بعد دوباره کمی بپز». هیچ‌کس نمی‌ایستد و *خیره* به قابلمه نگاه می‌کند. وقتی یکی می‌گوید «در حال انتظارم»، کنار می‌رود و **صاحبِ اجاق** (یعنی **event loop**) اجازه می‌دهد *نفرِ دیگر* کمی بپزد. «انتظار» هرگز آشپزخانه را متوقف نمی‌کند — فقط اجاق را خالی می‌کند تا نفرِ بعدی بتواند از آن استفاده کند. همه‌ی asyncio همین است: آدم‌ها (coroutine‌ها) در \`await\` کنار می‌روند تا اجاق (event loop) بتواند از همه به‌طور عادلانه پذیرایی کند.

\`\`\`schematic
{
  "id": "asyncio-event-loop-tick",
  "title": "The event loop hands the tick task by task",
  "nodes": [
    {
      "id": "loop",
      "label": "EventLoop",
      "sub": "a queue of ready tasks",
      "type": "note"
    },
    {
      "id": "a1",
      "label": "task A",
      "sub": "run to its await · tick 1"
    },
    {
      "id": "b1",
      "label": "task B",
      "sub": "run to its await · tick 2"
    },
    {
      "id": "a2",
      "label": "task A",
      "sub": "resumes after the await · tick 3"
    },
    {
      "id": "done",
      "label": "all tasks done",
      "sub": "the loop stops",
      "type": "note"
    }
  ],
  "edges": [
    {
      "from": "loop",
      "to": "a1",
      "label": "step"
    },
    {
      "from": "a1",
      "to": "b1",
      "label": "A suspends"
    },
    {
      "from": "b1",
      "to": "a2",
      "label": "B suspends"
    },
    {
      "from": "a2",
      "to": "done",
      "label": "A finishes"
    }
  ],
  "legend": [
    {
      "color": "amber",
      "label": "a tick advances one task"
    },
    {
      "color": "muted",
      "label": "the loop and the finish"
    }
  ]
}
\`\`\`

## Intermediate

یک **coroutine** شیئی است که *محلِ ذخیره‌شده‌ی* یک تابع را نگه می‌دارد. صدا‌زدن یک \`async def\` بدنه را **اجرا نمی‌کند** — به شما یک coroutine می‌دهد (یک نشانک روی صفحه‌ی 0 آن تابع). یک **task** یک *دسته‌ی نام‌گذاری‌شده* (named handle) برای یک coroutine است، و **event loop** یک صف از task‌های آماده (ready) است.

- \`async def\` یک تابع‌coroutine می‌سازد؛ **صدا‌زدنِ** آن یک coroutine برمی‌گرداند.
- \`a.create_task(coro)\` یک coroutine را در یک task پیچ می‌کند.
- \`await\` یک **تعویق (suspension)** است: task نشانکش را می‌گذارد و نوبت را تسلیم (yield) می‌کند تا event loop بتواند نفرِ دیگر را اجرا کند.
- \`a.run(t1, t2, ...)\` event loop را شروع می‌کند: هر taskِ آماده را تا \`await\` بعدی‌اش جلو می‌برد، بعد می‌رود سراغ بعدی، تا همه تمام شوند.

هیچ‌چیزی متوقف (block) نمی‌شود. یک taskِ معوق فقط شیئی است که روی صفِ event loop نشسته.

## Advanced

مدلِ ذهنی: **event loop یک صفِ round-robin از task‌های آماده است، و \`await\` همان‌جایی است که task دوباره وارد صف می‌شود.** کلِ تصویرِ asyncio همین است.

- هم‌زمان فقط یک task اجرا می‌شود، تا \`await\` بعدی‌اش یا return. به این **یک تیک (tick)** می‌گویند.
- task‌ها با هم قاطی (interleave) می‌شوند: A، B، A، B… — می‌توانید در خروجیِ round-robin شده‌اش *آن را ببینید* (هر task خطِ خودش را می‌چاپد، بین خطوطِ taskِ دیگر).
- \`await a.sleep(0.1)\` همان کاری است که task با آن *بدون block شدن* صبر می‌کند — تیک را تسلیم می‌کند، تا task‌های دیگر در حالی که او «صبر» می‌کند ادامه دهند.
- پس سؤالِ همیشگی: *این task کِی نوبتش را تسلیم می‌کند و در همین فاصله چه کسی اجرا می‌شود؟* هر \`await\` یک فاصله است که event loop می‌تواند پُر کند.

## Expert

مکانیک، دقیق.

- یک coroutine \`{status, pc, locals}\` ذخیره می‌کند. \`pc\` نشانه‌دهنده‌ی دستور (instruction pointer) است؛ \`locals\` متغیرهای ذخیره‌شده‌ی فریم است. یک تیک دستورها را از \`pc\` اجرا می‌کند تا یک \`await\`ِ هم‌کاری (ذخیره‌کردنِ locals و ادامه در تیکِ بعد) یا یک \`return\` (ثبتِ نتیجه و علامت‌گذاریِ done).
- یک task \`{coro, name, status}\` است با یک چرخه‌ی حیات: **pending → ready → suspended ⇄ ready → done** (به تصویرِ حالات در پایین نگاه کنید). \`create_task\` یک coroutine‌ی pending را به ready ارتقا می‌دهد.
- event loop \`{ready, done, tick}\` است. در هر تیک، taskِ آماده‌ی بعدی را برمی‌دارد، coroutine آن را یک بار جلو می‌برد، و دوباره به صف برمی‌گرداند (ready) یا به done می‌برد. \`tick\` می‌شمارد که event loop چند‌بار اجاق را به یک task داده است.

\`\`\`schematic
{
  "id": "asyncio-task-states",
  "title": "A task's states across the loop",
  "nodes": [
    {
      "id": "pending",
      "label": "pending",
      "sub": "a fresh coroutine"
    },
    {
      "id": "ready",
      "label": "ready",
      "sub": "queued on the loop"
    },
    {
      "id": "suspended",
      "label": "suspended",
      "sub": "waiting at an await"
    },
    {
      "id": "done",
      "label": "done",
      "sub": "returned"
    }
  ],
  "edges": [
    {
      "from": "pending",
      "to": "ready",
      "label": "create_task"
    },
    {
      "from": "ready",
      "to": "suspended",
      "label": "await"
    },
    {
      "from": "suspended",
      "to": "ready",
      "label": "loop resumes it"
    },
    {
      "from": "ready",
      "to": "done",
      "label": "returns"
    }
  ],
  "legend": [
    {
      "color": "amber",
      "label": "moving on the loop"
    },
    {
      "color": "coral",
      "label": "suspended at an await"
    },
    {
      "color": "teal",
      "label": "settled"
    }
  ]
}
\`\`\`

## Master

این مدل کجا به‌کار می‌آید و کجا تمام می‌شود.

- **asyncio واقعی** روی یک event loop *واقعی* با مدل رویدادِ واقعی اجرا می‌شود: زمانِ real-time (wall-clock)، I/O فایل/شبکه، threadها و \`async for\`/\`async with\`. این بصرساز فقط *زمان‌بندی* (schedule) را شبیه‌سازی می‌کند — همان round-robinِ مبتنی بر تیک — چون آن مدلِ ذهنی است؛ زمانِ واقعی و I/O واقعی را شبیه‌سازی نمی‌کند.
- **\`await\` روی هر چیزی، یک yield است.** await کردنِ یک sleep، یک future یا یک فراخوانی I/O همه کارِ یکسان را انجام می‌دهند: تیک را پس می‌دهند. تفاوت در *کِی* دوباره اجرا می‌شوند است.
- **یک thread، خیلی coroutine.** هم‌زمانی (concurrency) اینجا *هم‌کاری* (cooperative) است: هیچ taskی اجرا نمی‌شود مگر آنکه taskِ دیگری نوبتش را تسلیم کند. به همین دلیل یک taskِ گنگ و بدون \`await\` می‌تواند event loop را گرسنه (starve) بگذارد — دقیقاً همان درسی که مدلِ تیک آشکار می‌کند.
- **\`gather\`** یک گروه از task‌ها را اجرا می‌کند و نتایجشان را جمع می‌آورد؛ **lockها** و صف‌ها (queue) وقتی task‌ها باید روی داده‌های مشترک هماهنگ شوند، ترتیب اضافه می‌کنند (این سری به listهای مشترک محدود می‌ماند تا قاطی‌شدن خوانا بماند).
`,
    threading: `## Beginner

فکر کنید **دو بچه و یک قوطی شکلات**. کارِ هر بچه این است: «ببین قوطی چند تا شکلات دارد، عدد را بردار، بعد عدد به‌علاوه‌ی یک را روی قوطی بنویس.» اگر بچه‌ی اول نگاه کند (0) و *پیش از* اینکه بنویسد، بچه‌ی دوم هم نگاه کند (0)، بعد هر دو «1» را می‌نویسند. قوطی می‌گوید **1** — هرچند دو بچه شکلات اضافه کرده‌اند. شمارشِ یک بچه **پاک شد**. همه‌ی ایده همین است: دو نفر روی یک چیزِ مشترک، که پا به پای هم لیز می‌خورند. یک **lock (قفل)** یک تابلوی کوچکی است که می‌گوید «فقط یک نفر هم‌زمان می‌تواند دست به قوطی بزند» — بچه‌ی دوم باید بیرون صبر کند تا بچه‌ی اول تابلو را برگرداند.

\`\`\`schematic
{
  "id": "threading-lost-update",
  "title": "A read-modify-write splits across two threads",
  "nodes": [
    {
      "id": "box",
      "label": "box",
      "sub": "[0] · shared",
      "type": "buffer"
    },
    {
      "id": "t1",
      "label": "thread 1",
      "sub": "v = box[0]  →  v = 0"
    },
    {
      "id": "t2",
      "label": "thread 2",
      "sub": "v = box[0]  →  v = 0"
    },
    {
      "id": "w1",
      "label": "thread 1",
      "sub": "box[0] = v + 1  →  [1]"
    },
    {
      "id": "w2",
      "label": "thread 2",
      "sub": "box[0] = v + 1  →  [1]  (clobbers!)"
    },
    {
      "id": "lost",
      "label": "box = [1]",
      "sub": "expected [2] — one update lost",
      "type": "note"
    }
  ],
  "edges": [
    {
      "from": "t1",
      "to": "box",
      "label": "reads 0",
      "dashed": true
    },
    {
      "from": "t2",
      "to": "box",
      "label": "reads 0",
      "dashed": true
    },
    {
      "from": "w1",
      "to": "box",
      "label": "writes 1"
    },
    {
      "from": "w2",
      "to": "box",
      "label": "writes 1"
    },
    {
      "from": "w2",
      "to": "lost"
    }
  ],
  "legend": [
    {
      "color": "coral",
      "label": "a thread reads the shared box"
    },
    {
      "color": "amber",
      "label": "a thread writes it back"
    },
    {
      "color": "muted",
      "label": "the lost-update result"
    }
  ]
}
\`\`\`

## Intermediate

یک **thread** یک *فراخوانی است که در جایِ خودش اجرا می‌شود*، ولی هنوز از **همان حافظه‌ی** همه استفاده می‌کند. یک شیء **threading.Thread(target, args)** هنوز اجرا نمی‌شود — یک فراخوانیِ شروع‌نشده است (مثل شیءِ coroutine، ولی برای threadها).

- \`t.Thread(bump, (box,))\` یک thread می‌سازد که \`bump(box)\` را اجرا خواهد کرد.
- \`w.start()\` آن را علامت‌گذاری می‌کند که در حال اجراست. در واقع **داخل \`w.join()\`** اجرا می‌شود.
- \`w.join()\` **زمان‌بین (scheduler)** است: threadهای شروع‌شده را **یک دستور** در هر نوبت، به‌صورت round-robin، تا پایان اجرا می‌کند.
- چون دستور‌به‌دستور جلو می‌رود، دو thread که روی **همان شیء** خواندن و نوشتن انجام می‌دهند، می‌توانند روی آن شیء قاطی (interleave) شوند.

اینجا thread واقعیِ OS یا هسته‌ی CPU وجود ندارد — *preemption* (گرفتن نوبت) شبیه‌سازی می‌شود و قاطی‌شدن در چیزی ظاهر می‌شود که شیءِ مشترک در نهایت نگه می‌دارد.

## Advanced

مدلِ ذهنی: **threadها heap را به اشتراک می‌گذارند و بعد از هر دستور preempt می‌شوند.** همان preemption کلِ ماجراست.

- یک اتصالِ ساده مثل \`box[0] = box[0] + 1\` اتمی (atomic) به نظر می‌رسد، ولی یک read-modify-writeِ واقعی در واقع *اول خواندن، بعد محاسبه، بعد نوشتن* است — سه مرحله. وقتی thread می‌تواند بین خواندن و نوشتن قطع شود، threadِ دیگر مقدارِ **قدیمی (stale)** را می‌خواند.
- پس برای آنکه race را آشکار کنیم، افزایش را به دو دستور شکسته‌ایم — اول \`v = box[0]\` و بعد \`box[0] = v + 1\` — دقیقاً همان خواندن-سپس-نوشتن که زمان‌بین می‌تواند بین آن‌ها بزند.
- سؤالِ همیشگی: *کدام threadها می‌توانند روی این شیء قاطی شوند، و ترتیبِ خواندن و نوشتنشان اطلاعات را از دست می‌دهد؟*
- یک **lock** پاسخ می‌دهد: \`lk.acquire()\` / \`lk.release()\` یک بخشِ حساس (critical section) را احاطه می‌کنند تا هم‌زمان فقط یک thread داخلش باشد.

## Expert

مکانیک، دقیق.

- یک thread \`{target, name, status, pc, locals, returnValue}\` ذخیره می‌کند. \`pc\` شمارنده‌ی برنامه (program counter) است؛ \`locals\` متغیرهای ذخیره‌شده‌ی فریمِ آن است؛ \`status\` جابه‌جا می‌شود **not-started → running ⇄ blocked → done**.
- \`threadJoin\` همه‌ی threadهای شروع‌شده را round-robin می‌کند. در هر نوبت، localsِ ذخیره‌شده‌ی thread را روی پشته‌ی فریم push می‌کند و **دقیقاً یک دستور** اجرا می‌کند (\`stepThread\`)، بعد locals را دوباره ذخیره می‌کند و preempt می‌کند. همان «یک دستور در هر نوبت» چیزی است که قاطی‌شدن را اجبار می‌کند.
- \`lockAcquire\` روی یک lockِ آزاد (یا یکی که *این* thread دارد) آن را می‌گیرد. اگر lock را *threadِ دیگر* داشته باشد، فراخواننده را **معلق** (suspend) می‌کند (\`status\` → blocked، \`pc\` روی همان \`acquire()\` می‌ماند) و در نوبتِ بعد دوباره می‌کوشد — یعنی تا زمانی که دارنده \`release()\` بکند، block می‌ماند. برخلاف یک \`await\`ِ یک‌بار، یک \`acquire\`ِ block‌شده **از خودش عبور نمی‌کند**؛ تا آنکه اجازه بگیرد، دوباره و دوباره اجرا می‌شود.
- یک دور کامل بدون هیچ پیشرویِ واقعی، **deadlock** (گلوگاه؛ درگیریِ متقابل روی lockها) است؛ زمان‌بین آن را تشخیص می‌دهد و به‌جای جا ماندن متوقف می‌شود.

\`\`\`schematic
{
  "id": "threading-lock-critical-section",
  "title": "A lock makes the read-modify-write atomic",
  "nodes": [
    {
      "id": "lk",
      "label": "lock",
      "sub": "a gate: one holder at a time",
      "type": "note"
    },
    {
      "id": "t1a",
      "label": "thread 1",
      "sub": "acquire → reads 0 → writes 1"
    },
    {
      "id": "t1b",
      "label": "thread 1",
      "sub": "release"
    },
    {
      "id": "t2a",
      "label": "thread 2",
      "sub": "acquire (waits until release)"
    },
    {
      "id": "t2b",
      "label": "thread 2",
      "sub": "reads 1 → writes 2"
    },
    {
      "id": "ok",
      "label": "box = [2]",
      "sub": "both updates land",
      "type": "note"
    }
  ],
  "edges": [
    {
      "from": "lk",
      "to": "t1a",
      "label": "held by t1"
    },
    {
      "from": "t1a",
      "to": "t1b"
    },
    {
      "from": "t1b",
      "to": "t2a",
      "label": "frees the gate"
    },
    {
      "from": "lk",
      "to": "t2a",
      "label": "now held by t2"
    },
    {
      "from": "t2a",
      "to": "t2b"
    },
    {
      "from": "t2b",
      "to": "ok"
    }
  ],
  "legend": [
    {
      "color": "amber",
      "label": "a thread holds the lock inside its critical section"
    },
    {
      "color": "muted",
      "label": "the gate and the safe result"
    }
  ]
}
\`\`\`

## Master

این مدل کجا به‌کار می‌آید و کجا تمام می‌شود.

- **threadهای واقعی** روی هسته‌های واقعیِ CPU با یک زمان‌بین واقعیِ OS اجرا می‌شوند: context switchهای غیرتعیینی (nondeterministic)، GIL، هم‌گراییِ cache (cache coherence) و preemptionِ واقعی در هر مرزِ دستور. این بصرساز *زمان‌بندی* را شبیه‌سازی می‌کند (یک دستور در هر دور) تا قاطی‌شدن **تعیینی و قابل‌تکرار** باشد — یک ویژگیِ آموزشی، نه ویژگیِ Python واقعی.
- **\`join\` زمان‌بینِ شماست.** در Python واقعی، OS threadها را قاطی می‌کند؛ اینجا \`join\` آن‌ها را round-robin می‌کند تا یک قاطی‌شدنِ *خاص* را *ببینید*. به همین دلیل درس تعیینی است: race نه «گاهی‌اوقات» است، که «همیشه، اینجا، به این ترتیب» — که هم‌رنگِ آموزش است.
- **data race واقعی است و راه‌حلش هم واقعی است.** یک به‌روزرسانیِ گمشده روی وضعیتِ قابل‌تغییرِ مشترک، در شرایطِ read-modify-write هم‌زمان، رایج‌ترین باگِ هم‌زمانی است. یک lock (یا یک شیءِ اتمی، یا یک queue) بخشِ حساس را اتمی می‌کند. همه‌ی چیزهایی که این سری نشان می‌دهد — boxِ مشترک، read-modify-write‌ی قاطی‌شده، lock که آن را سریالی می‌کند — مستقیم به threadهای واقعی، asyncio با وضعیتِ مشترک، و تراکنش‌های پایگاه‌داده منتقل می‌شود.
- **بازگشتِ مقدار توسط \`lock.acquire()\`:** \`Lock.acquire(blocking=True)\`ِ واقعی block می‌کند؛ اینجا thread را معلق می‌کند و دوباره می‌کوشد که همان *اثر* را آشکار می‌کند. یک lockِ **re-entrant** (که توسط همان thread نگه داشته شده) دوباره و بی‌درنگ گرفته می‌شود، مطابق با self-reentryِ یک RLockِ واقعی.
`,
  },
  levels: {
    'as-make-coro': {
      name: 'صدا‌زدنِ یک async def',
      brief: '`async def greet():` را تعریف کنید و `c = greet()` را صدا بزنید. صدا‌زدن بدنه را اجرا نمی‌کند — یک **coroutine** برمی‌گرداند، یعنی یک محلِ ذخیره‌شده در آن تابع.',
      lesson: `یک **async def** یک تابع‌coroutine است. صدا‌زدنش بدنه را **اجرا نمی‌کند** — یک شیء **coroutine** برمی‌گرداند، یعنی یک محلِ ذخیره‌شده (روی دستور 0) در آن تابع. هنوز چیزی اجرا نشده: نه خروجی، نه پیشرفت. بدنه بعداً اجرا می‌شود، وقتی چیزی coroutine را تیک‌به‌تیک جلو ببرد.`,
      learning: ['صدا‌زدنِ یک async def یک coroutine برمی‌گرداند، نه یک نتیجه', 'بدنه هنوز اجرا نشده — coroutine یک محلِ ذخیره‌شده است'],
      fieldNotes: ['یک coroutine شیئی است که می‌توان جابه‌جا کرد (مثلاً به‌عنوان آرگومانِ create_task)', '`await None` در بدنه یک نقطه‌ی تعویق است که event loop بعداً به آن می‌رسد'],
    },
    'as-create-task': {
      name: 'پیچیدنِ یک coroutine در یک task',
      brief: '`c = greet()` (یک coroutine) و `t = a.create_task(c)` را بسازید. یک **task** یک *دسته‌ی نام‌گذاری‌شده* برای یک coroutine است — واحدی که event loop زمان‌بندی می‌کند.',
      lesson: `یک **task** یک *دسته‌ی نام‌گذاری‌شده* برای یک coroutine است — همان چیزی که event loop در واقع زمان‌بندی می‌کند. \`create_task(c)\` coroutineِ \`c\` را در یک task پیچ می‌کند که با حالت **ready** شروع می‌شود: در صف نشسته و منتظر است event loop آن را اجرا کند. task و coroutine دو شیء هستند: task به coroutine *اشاره می‌کند*.`,
      learning: ['یک task یک دسته‌ی نام‌گذاری‌شده برای یک coroutine است', 'create_task coroutine را به حالت ready می‌برد، در صفِ event loop'],
      fieldNotes: ['`create_task` یک Task برمی‌گرداند — هم event loop و هم `gather` task می‌گیرند', 'یک coroutine در asyncio واقعی فقط یک‌بار می‌تواند در یک task پیچیده شود'],
    },
    'as-run-one': {
      name: 'اجرای event loop (یک task)',
      brief: 'یک task بسازید `t = a.create_task(greet())` و event loop را با `a.run(t)` شروع کنید. event loop task را تا پایان جلو می‌برد — همان `print` ظاهر می‌شود.',
      lesson: `\`a.run(t)\` **event loop** را شروع می‌کند. task را برمی‌دارد، coroutine آن را تا \`await\` بعدی جلو می‌برد («hi» را چاپ می‌کند)، task معلق می‌شود، و در تیکِ بعد از \`await\` ادامه می‌دهد و برمی‌گردد — **done**. یک task، چند تیک، و event loop متوقف می‌شود چون صف خالی است.`,
      learning: ['a.run event loop را شروع می‌کند و task‌ها را تا پایانِ همه جلو می‌برد', 'هر تیک، taskِ فعلی را تا await یا return بعدی‌اش جلو می‌برد'],
      fieldNotes: ['`a.run` وقتی که همه‌ی task‌ها تمام شدند برمی‌گردد', 'event loop همان زمان‌بین است — بدون آن، taskی هرگز اجرا نمی‌شود'],
    },
    'as-await-yields': {
      name: 'await تیک را تسلیم می‌کند',
      brief: 'دو task، `a.run(t1, t2)`. task 1 چاپ می‌کند، بعد `await` می‌کند — **معلق** می‌شود، و event loop تیک را به task 2 می‌دهد پیش از آنکه برگردد. ببینید خروجی چطور قاطی می‌شود.',
      lesson: `کلِ درس، به‌صورتِ قابلِ رؤیت. \`first()\` «1a» را چاپ می‌کند، به \`await\` می‌رسد و **معلق** می‌شود — event loop صبر نمی‌کند، می‌رود سراغ taskِ آماده‌ی *بعدی*. \`second()\` «2» را چاپ می‌کند و برمی‌گردد. فقط آنگاه است که event loop به \`first()\` برمی‌گردد که «1b» را چاپ می‌کند و تمام می‌شود. خروجی \`1a, 2, 1b\` همان اثبات است: **\`await\` هرگز block نمی‌کند — تیک را تسلیم می‌کند تا نفرِ دیگر اجرا شود.**`,
      learning: ['await taskِ فعلی را معلق می‌کند و اجازه می‌دهد event loop taskِ آماده‌ی بعدی را اجرا کند', 'دو task قاطی می‌شوند (A، B، A) به‌جای اجرای یکی‌بعدِ‌دیگری'],
      fieldNotes: ['ترتیبِ خروجی — نه ترتیبِ کد — است که هم‌زمانی (concurrency) را نشان می‌دهد', '`await None` حداقلِ yield است؛ کد واقعی sleep / I/O / future را await می‌کند'],
    },
    'as-produce-consume': {
      name: 'Capstone: تولیدکننده و مصرف‌کننده',
      brief: 'دو taskِ هم‌کار روی یک **listِ مشترک**: `producer` اضافه می‌کند، `consumer` می‌خواند، و هر دو در `await` نوبت می‌دهند. هر دو را اجرا کنید — قاطی می‌شوند و consumer آنچه را producer نوشته دیده است.',
      lesson: `Capstone. دو task **از طریق یک listِ مشترک با هم همکاری می‌کنند**. \`producer\` «p1» را اضافه می‌کند و در \`await\` نوبت می‌دهد؛ event loop \`consumer\` را اجرا می‌کند که نوبت می‌دهد (پس *بعد* از اولین نوشتنِ producer اجرا می‌شود) و «p1» را چاپ می‌کند. برگشت به \`producer\` که «p2» را اضافه می‌کند و تمام می‌شود. consumer **دیده** است که producer چه نوشته، چون هر دو task همان شیءِ list را به اشتراک دارند — و \`await\` آن‌ها را ترتیب داده است. همین هماهنگی‌از-طریق-yield، ذاتِ async است: **task‌ها block نمی‌کنند، event loop را پس می‌دهند، و وضعیتِ مشترک چیزی است که مبادله می‌کنند.**`,
      learning: ['task‌ها با به‌اشتراک‌گذاریِ وضعیت و نوبت‌دادن در ترتیبِ درست، هماهنگ می‌شوند', 'await تعیین می‌کند چه کسی چه نوشتنی را می‌بیند — consumer بعد از نوشتنِ producer می‌خواند'],
      fieldNotes: ['asyncio واقعی از queue/lock برای ترتیب‌دادنِ صریحِ producer و consumer استفاده می‌کند', 'این مدل تصویرِ وضعیتِ مشترک را نگه می‌دارد — همان بخشی که از دیدِ حافظه بهتر آموزش داده می‌شود'],
    },
    'th-make-thread': {
      name: 'ساختنِ یک thread',
      brief: '`bump(box)` را تعریف کنید و `w = t.Thread(bump, (box,))` را بسازید. یک شیء **thread** هنوز اجرا نمی‌شود — یک فراخوانیِ شروع‌نشده است که حافظه‌ی ماژول را به اشتراک می‌گذارد.',
      lesson: `یک **thread** فراخوانی‌ای است که در فریمِ خودش اجرا می‌شود ولی حافظه‌ی ماژول را به اشتراک می‌گذارد. \`t.Thread(bump, (box,))\` **اجرا نمی‌کند** \`bump\` را — یک threadِ *شروع‌نشده* می‌سازد که *خواهد کرد* \`bump(box)\` را اجرا. تابعِ هدف و \`box\`ِ مشترک ثبت می‌شوند؛ هنوز چیزی اجرا نشده، پس \`box\` هنوز \`[0]\` است. مثل شیءِ coroutine، یک thread یک فراخوانیِ ذخیره‌شده است که می‌توان آن را جابه‌جا کرد و بعداً شروع کرد.`,
      learning: ['یک شیء Thread یک فراخوانیِ شروع‌نشده است — تابعِ هدف هنوز اجرا نشده', 'threadها heapِ ماژول را به اشتراک می‌گذارند — همان box که دست می‌زنند، همان شیء است'],
      fieldNotes: ['`t.Thread(target, args)` اینجا positional است (در این زیرمجموعه آرگومانِ keyword نداریم)', 'یک شیء thread قابل‌استفاده‌دوباره است: startش کنید، بعد joinش کنید تا اجرا شود'],
    },
    'th-start-join': {
      name: 'شروع و join کردنِ یک thread',
      brief: 'thread را بسازید، بعد `w.start()` و `w.join()`. join همان **زمان‌بین** است — thread را تا پایان اجرا می‌کند و `box`ِ مشترک از `[0]` به `[1]` تغییر می‌کند.',
      lesson: `\`start()\` thread را علامت‌گذاری می‌کند که در حال اجراست؛ در واقع داخل \`w.join()\` اجرا می‌شود. **join همان زمان‌بین است**: thread را دستور‌به‌دستور جلو می‌برد تا تمام شود. \`bump\` مقدار \`box[0]\` را می‌خواند (0)، بعد \`v + 1\` را برمی‌نویسد — پس boxِ مشترک \`[0] → [1]\` می‌شود. یک thread، یک read-modify-write‌ی تمیز، یک افزایش. هنوز race‌ای نیست چون فقط یک thread دست به box می‌زند.`,
      learning: ['join() همان زمان‌بینی است که یک threadِ شروع‌شده را در واقع اجرا می‌کند', 'یک threadِ تنها، read-modify-write‌اش را اتمی انجام می‌دهد — با یک thread، race‌ای نیست'],
      fieldNotes: ['در Python واقعی، OS thread را اجرا می‌کند؛ اینجا join آن را round-robin می‌کند تا بتوانید تماشا کنید', 'thread همان boxِ مشترک را در همان‌جا تغییر داد — ماژول حالا [1] می‌بیند'],
    },
    'th-race': {
      name: 'دو thread، یک box: به‌روزرسانیِ گمشده',
      brief: 'دو **thread** اجرا کنید که هرکدام همان `box` را افزایش می‌دهند، بدون lock. چون دستور‌به‌دستور preempt می‌شوند، هر دو پیش از هرگونه نوشتن `box[0]=0` را می‌خوانند — پس `box` روی **1، نه 2** می‌ماند. همان به‌روزرسانیِ گمشده، data race است.',
      lesson: `کلِ درس همین است. \`join\` دو thread را **یک دستور در هر نوبت** round-robin می‌کند: thread 1 مقدار \`box[0]\` را در \`v\` می‌خواند (→ 0)؛ بعد thread 2 مقدار \`box[0]\` را در \`v\`ِ *خودش* می‌خواند (→ 0، box هنوز 0 است)؛ بعد thread 1 مقدار \`v + 1\` را می‌نویسد (box → 1)؛ بعد thread 2 مقدار \`v + 1\`ِ *خودش* را می‌نویسد (box → 1). هر دو thread همان **0ِ قدیمیِ مشترک** را خوانده‌اند، پس نوشتنِ دومین بر اولین می‌نشیند و آن را می‌پوشاند — box روی **1** می‌ماند، نه 2. این یک **data race** است: یک read-modify-write که آن‌قدر قاطی شده که یک به‌روزرسانی از دست می‌رود. باگ در هیچ‌کدام از threadها نیست؛ در *به‌اشتراک‌گذاریِ* box بدون هماهنگی است.`,
      learning: ['دو thread روی یک شیء، دستور‌به‌دستور قاطی می‌شوند', 'یک read-modify-write که در قاطی‌شدن شکافته شود، یک به‌روزرسانی از دست می‌دهد (box روی 1 می‌ماند، نه 2)'],
      fieldNotes: ['threadهای CPythonِ واقعی به همین race می‌خوردند — GIL، `x = x + 1` را روی وضعیتِ مشترک امن نمی‌کند', 'race روی CPUهای واقعی *غیرتعیینی* است؛ اینجا join یک قاطی‌شدن را تعیینی می‌کند تا قابل‌آموزش باشد'],
    },
    'th-lock': {
      name: 'رفعِ race با یک lock',
      brief: 'به هر thread یک `lk = t.Lock()`ِ مشترک بدهید و read-modify-write را با `lk.acquire()` / `lk.release()` احاطه کنید. حالا هم‌زمان فقط یک thread داخل است — box روی **2** می‌ماند. race رفته است.',
      lesson: `راه‌حل. \`lk.acquire()\` همان دروازه است: thread 1 آن را می‌گیرد و کلِ read-modify-write‌اش (0 → 1) را **پیش از** آزاد کردن انجام می‌دهد. وقتی thread 2 تلاش می‌کند بگیرد، lock **در دست** است، پس *block* (معلق) می‌شود و در نوبتِ بعد دوباره می‌کوشد — فقط وقتی وارد می‌شود که thread 1 آزاد کرده باشد. داخلِ بخشِ حساس حالا boxِ **به‌روزشده** (1) را می‌خواند و 2 را می‌نویسد. انحصارِ دوطرفه (mutual exclusion) read-modify-write را در برابر threadِ دیگر **اتمی** کرد، پس هر دو افزایش رسیده می‌شوند: box روی **2** می‌ماند و lock دوباره آزاد است. data race رفته است چون وضعیتِ مشترک همیشه فقط دستِ یک thread است.`,
      learning: ['یک lock، یک بخشِ حساس را اتمی می‌کند — هم‌زمان فقط یک thread داخلش', 'acquire() روی lockِ در‌دست، فراخواننده را block می‌کند تا دارنده release() کند', 'lock همان به‌روزرسانیِ گمشده را رفع می‌کند: box روی 2 می‌ماند، نه 1'],
      fieldNotes: ['کوچک‌ترین بخشِ حساسِ ممکن را احاطه کنید — نگه‌داشتنِ lock طولانی‌تر از حد ضروری، threadهایی را سریالی می‌کند که نیازی به آن ندارند', 'یک lockِ re-entrant (یک RLockِ واقعی) به همان thread اجازه می‌دهد دوباره acquire کند؛ اینجا lockِ در‌دستِ خود بی‌درنگ گرفته می‌شود'],
    },
    'th-critical-capstone': {
      name: 'Capstone: block شدن، صبر کردن و ادامه‌ی به‌ترتیب',
      brief: 'دو thread، یک lock: `hold` lock را می‌گیرد، چاپ می‌کند، آزاد می‌کند؛ `wait_then` تلاش می‌کند بگیرد و تا آزاد شدنِ `hold` **block** می‌شود، بعد ادامه می‌دهد. ترتیبِ خروجی ثابت می‌کند که lock آن‌ها را مرتب کرده: `A holds` پیش از `B proceeds`.',
      lesson: `Capstone: **انحصارِ دوطرفه به‌عنوانِ ترتیب**. \`ta\` (\`hold\`) اول lock را می‌گیرد، «A holds» را چاپ می‌کند و آزاد می‌کند. \`tb\` (\`wait_then\`) تلاش می‌کند بگیرد ولی lock **در دست** است — پس block می‌شود و روی \`acquire()\` معلق می‌ماند بدون آنکه جلو برود. وقتی \`ta\` آزاد می‌کند، \`tb\` دوباره می‌کوشد، lock را می‌گیرد و *آنگاه* «B proceeds» را چاپ می‌کند. بومِ حافظه را تماشا کنید: در حالی که \`tb\` block است، جعبه‌ی thread آن **blocked** (coral) می‌خواند و جعبه‌ی lock **HELD** توسط \`ta\`. خروجی — «A holds» و بعد «B proceeds» — همان اثبات است که lock دو threadِ مستقل روی وضعیتِ مشترک را *مرتب* کرده است. دقیقاً همان چیزی است که lock به شما می‌دهد: نه فقط درستی، بلکه **ترتیبِ تعیینی** روی یک بخشِ حساس.`,
      learning: ['acquire() روی lockِ در‌دست، فراخواننده را block می‌کند (status → blocked) تا release', 'انحصارِ دوطرفه به شما ترتیب می‌دهد، نه فقط ایمنی — B فقط بعد از آزاد‌کردنِ A اجرا می‌شود', 'یک threadِ block‌شده یک وضعیتِ قابل‌رؤیت است، نه راز — بوم آن را نشان می‌دهد'],
      fieldNotes: ['همین شیوه‌ای است که هر بخشِ حساسِ محافظت‌شده با mutex رفتار می‌کند — ترتیبِ خروجی همان قرارداد است', 'deadlock همان حالتِ شکستِ lockهاست: اگر A روی lockی صبر می‌کرد که B داشت و B روی lockی که A داشت، هیچ‌کدام هرگز آزاد نمی‌کرد'],
    },
  },
};
