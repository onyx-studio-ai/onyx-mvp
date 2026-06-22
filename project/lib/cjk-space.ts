/*
  Insert a space between CJK and Latin/number runs so mixed text reads cleanly
  on the public profile — "LINDOR農曆新年" -> "LINDOR 農曆新年". Display-only;
  we never mutate what the talent typed. Only adds a space where one is missing,
  so already-spaced text is untouched.
*/
export const cjkSpace = (s?: string | null): string =>
  (s || '')
    .replace(/([一-鿿぀-ヿ㐀-䶿])([A-Za-z0-9@#$%])/g, '$1 $2')
    .replace(/([A-Za-z0-9!?%)])([一-鿿぀-ヿ㐀-䶿])/g, '$1 $2');
