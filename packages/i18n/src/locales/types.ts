import { ko } from './ko';

// ko.ts is `as const` so TranslationKey (below) can be derived from its
// exact literal keys — but that also makes every leaf a literal string
// type, which would force en.ts's `satisfies` check to require the exact
// Korean text. Widen every leaf back to plain `string` for the shape that
// other locale files are checked against.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };
export type Dictionary = Widen<typeof ko>;

// Dotted-path union of every leaf string key in the dictionary,
// e.g. 'error.AUTH-001'. Keeps t() calls typo-checked against ko's shape.
type Join<K extends string, P extends string> = P extends '' ? K : `${K}.${P}`;
type Leaves<T> = {
  [K in keyof T & string]: T[K] extends string ? K : Join<K, Leaves<T[K]>>;
}[keyof T & string];

export type TranslationKey = Leaves<typeof ko>;
