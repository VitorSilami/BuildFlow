// `<select>` nativo (não SelectField/Radix) propositalmente para os campos que
// tests/e2e/rdo.spec.ts aciona via `.selectOption(...)` — esse metodo do
// Playwright exige um <select> real (`Element is not a <select> element` ao
// tentar num Radix Select, que renderiza um <button role="combobox">, ja que
// getByLabel resolve para o elemento com o id do <label for>, que e o trigger,
// nao um <select> nativo escondido). Confirmado rodando o spec (nao pode ser
// alterado) contra a versao com SelectField em todos os campos.
export const NATIVE_SELECT_CLASSNAME =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'
