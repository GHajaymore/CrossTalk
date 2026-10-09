// Text helpers that work in every episode language: Chinese and Japanese don't put spaces between
// words, and Hindi, Chinese, Japanese and Arabic end sentences with their own marks (। 。 ！ ？ ؟).

// Characters written without spaces between words: a spoken "word" is about two of them.
const UNSPACED = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/g;

/** About how many spoken words a text is, in any language. */
export function wordsIn(text: string): number {
  const unspaced = text.match(UNSPACED)?.length ?? 0;
  return text.replace(UNSPACED, ' ').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length + Math.ceil(unspaced / 2);
}

// A sentence ends at . ? ! before a space (or the end), or at 。！？।؟ anywhere; closing quotes stay with it.
const SENTENCE = /[\s\S]*?(?:[.?!…]+["'”’)\]]*(?=\s|$)|[。！？।؟!?]+["'”’)\]」』]*)\s*|[\s\S]+$/g;

/** A text's sentences, trimmed, in order. */
export const sentencesOf = (text: string): string[] => (text.match(SENTENCE) ?? []).map(s => s.trim()).filter(Boolean);

/** Everything up to the last complete sentence, or '' if there isn't one. */
export function wholeSentencesOf(text: string): string {
  const parts = text.trim().match(SENTENCE) ?? [];
  const last = parts[parts.length - 1];
  if (last && !/(?:[.?!…]+["'”’)\]]*|[。！？।؟!?]+["'”’)\]」』]*)\s*$/.test(last)) parts.pop();
  return parts.join('').trim();
}
