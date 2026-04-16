/** ASCII C0/C1 control characters and DEL — unsafe in generated shell and config strings. */
const ASCII_CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

export function containsAsciiControlCharacters(value: string): boolean {
  return ASCII_CONTROL_CHARS.test(value);
}
