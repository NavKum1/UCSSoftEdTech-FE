/**
 * Pseudo-localisation for layout testing, generated from the English messages (no files to maintain):
 * - en-XA: accented letters, ~35% longer, wrapped in [brackets] so truncation and hard-coded text stand out;
 * - ar-XB: English wrapped in a right-to-left override so it reads mirrored; with dir="rtl" this shows layout
 *   that does not mirror and any text that bypasses the message files (it stays readable left-to-right).
 * ICU syntax ({name}, {count, plural, one {...} other {...}}, #) and rich-text tags (<link>...</link>) are kept.
 */

type Messages = { [key: string]: string | Messages };

const FROM = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const TO = "åƀçðéƒĝĥîĵķļɱñöþǫŕšţûṽŵẋýžÅƁÇÐÉƑĜĤÎĴĶĻṀÑÖÞǪŔŠŢÛṼŴẊÝŽ";
const RLO = "‮";
const PDF = "‬";

const accent = (s: string) => s.replace(/[A-Za-z]/g, (c) => TO[FROM.indexOf(c)] ?? c);

/** Applies `fn` to the literal text of an ICU message, leaving arguments, plural/select keys and tags intact. */
function mapText(message: string, fn: (text: string) => string): string {
  let out = "";
  let i = 0;
  const n = message.length;

  // Reads literal text until an unmatched "}" (end of a plural/select branch) or the end of the message
  function text(stopAtBrace: boolean): string {
    let buf = "";
    let res = "";
    const flush = () => {
      res += buf ? fn(buf) : "";
      buf = "";
    };
    while (i < n) {
      const c = message[i];
      if (c === "}" && stopAtBrace) break;
      if (c === "{") {
        flush();
        res += argument();
        continue;
      }
      if (c === "<") {
        const close = message.indexOf(">", i);
        if (close > i) {
          flush();
          res += message.slice(i, close + 1);
          i = close + 1;
          continue;
        }
      }
      if (c === "#" && stopAtBrace) {
        flush();
        res += c;
        i++;
        continue;
      }
      buf += c;
      i++;
    }
    flush();
    return res;
  }

  // At "{": copies the argument; for plural/select/selectordinal, transforms each branch's text
  function argument(): string {
    const start = i;
    i++; // {
    let head = "";
    while (i < n && message[i] !== "}" && message[i] !== ",") head += message[i++];
    if (message[i] === "}") {
      i++;
      return message.slice(start, i);
    }
    // "," type
    i++;
    let type = "";
    while (i < n && message[i] !== "}" && message[i] !== ",") type += message[i++];
    const kind = type.trim();
    if (kind !== "plural" && kind !== "select" && kind !== "selectordinal") {
      // number/date/time with an optional style: copy up to the matching brace
      let depth = 1;
      while (i < n && depth > 0) {
        if (message[i] === "{") depth++;
        else if (message[i] === "}") depth--;
        i++;
      }
      return message.slice(start, i);
    }
    let res = `{${head},${type}`;
    // options: key {branch} key {branch} ... }
    while (i < n && message[i] !== "}") {
      const c = message[i];
      if (c === "{") {
        i++;
        res += "{" + text(true) + "}";
        i++; // }
      } else {
        res += c;
        i++;
      }
    }
    i++; // closing }
    return res + "}";
  }

  out = text(false);
  return out;
}

export function pseudoMessage(locale: string, message: string): string {
  if (locale === "ar-XB") return RLO + mapText(message, (t) => t) + PDF;
  const letters = (message.match(/[A-Za-z]/g) ?? []).length;
  const pad = "·".repeat(Math.max(1, Math.round(letters * 0.35)));
  return `[${mapText(message, accent)} ${pad}]`;
}

export function pseudoMessages(locale: string, messages: Messages): Messages {
  const out: Messages = {};
  for (const [k, v] of Object.entries(messages)) out[k] = typeof v === "string" ? pseudoMessage(locale, v) : pseudoMessages(locale, v);
  return out;
}
