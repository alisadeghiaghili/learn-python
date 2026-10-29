# ADR 013: Internationalisation, SVG Bidirectional Isolation, and Persian Typography

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Core Team

## Context

learn-python provides first-class trilingual pedagogy across English (EN), German (DE), and Persian (FA). While English and German are Left-to-Right (LTR) languages, Persian is Right-to-Left (RTL).

When the active locale is switched to Persian, `document.documentElement.dir` is set to `"rtl"`. In browsers and SVG rendering engines:
1. Mathematical canvas coordinates ($(x, y)$ in pixels) and Python execution semantics are intrinsically LTR.
2. SVG text elements inheriting `dir="rtl"` risk flipping anchor points, reversing container brackets (`[1, 2]` rendered inverted), or misaligning memory addresses (`0x1000`) and variable arrows.
3. High-quality Persian typography mandates strict adherence to Zero-Width Non-Joiner (ZWNJ, نیم‌فاصله, `\u200c`) for verbal prefixes (`می‌`, `نمی‌`) and plural/comparative suffixes (`‌ها`, `‌های`, `تر`, `ترین`).
4. Series titles and level descriptions must be completely translated without Fingilish or untranslated English titles leaking into production.

## Decision

1. **SVG Bidirectional Isolation:**
   - Enforce `direction: ltr; unicode-bidi: isolate;` on all memory canvas SVGs (`#canvas`), RAM byte layout SVGs (`#ram-canvas`), and chart SVGs (`.plot-svg`) via both explicit SVG presentation attributes and CSS declarations in `src/style.css`.
   - In `src/ui/memory.ts` `addText()`, enforce `direction: ltr` and `unicode-bidi: isolate` on every generated `<text>` node.
   - For mixed text containing Persian characters, split text segments and wrap Persian portions in `<tspan direction="rtl" unicode-bidi="isolate">` to preserve bidirectional stability.

2. **Persian Typography & Complete Translation Parity:**
   - Updated series titles in `src/i18n/fa-g3.ts` and `src/i18n/fa-g5.ts` to natural Persian:
     - `copy-semantics`: `'معناشناسی کپی (سطحی و عمیق)'`
     - `iterators`: `'تکرارکننده‌ها و پیمایش‌پذیرها (Iterators)'`
     - `functional`: `'رفتارهای پیش‌فرض و ابزارهای تابعی'`
     - `threading`: `'Threading: thread‌ها، وضعیت مشترک و data race'`
   - Updated level names:
     - `shallow-copy-dict`: `'کپی سطحی (Shallow copy)'`
     - `deep-copy-independence`: `'کپی عمیق (Deep copy)'`
   - Verified 100% ZWNJ compliance across all 123 levels, 25 series, and UI chrome copy.

3. **Automated Verification:**
   - Extended `tests/i18n.test.ts` with automated invariants validating:
     - 0 broken ZWNJ instances across all Persian levels and lessons.
     - 100% Persian translation coverage across all 123 levels and 25 series titles.
     - LTR direction and unicode-bidi isolation attributes on all board SVGs.

## Consequences

- Persian learners receive an authentic, beautifully typeset RTL interface while Python object graphs, memory addresses, and code expressions retain pristine mathematical and syntactic alignment.
- Zero bidirectional bleed or jumbled punctuation in complex visualization cards.
- Automated CI guarantees future level expansions cannot ship with untranslated English or typography regressions in German or Persian.
