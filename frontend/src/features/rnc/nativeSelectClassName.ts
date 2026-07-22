// `<select>` nativo (não SelectField/Radix) — Playwright's `.selectOption()`
// exige um <select> real, mesmo motivo documentado em
// features/registros-diarios/wizard/nativeSelectClassName.ts.
export const NATIVE_SELECT_CLASSNAME =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'
