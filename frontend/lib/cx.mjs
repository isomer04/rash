/**
 * Class composition helpers.
 *
 * Tailwind utilities do not cascade by specificity: two competing declarations
 * are resolved by stylesheet order, not by author intent. So a call site passing
 * `className="bg-surface-sunken"` to a Card whose base is `bg-surface-raised`
 * gets whichever the generated sheet happens to emit last. `tailwind-merge`
 * solves this and is not available — no new dependency may enter
 * `frontend/package.json` — so this module resolves the conflict itself.
 *
 * That is affordable here because the token vocabulary is closed: every utility
 * name a primitive may emit was authored in `styles/globals.css`, so an ordered
 * prefix table is sufficient and the ambiguous cases are enumerable.
 */

/** The nine authored type steps, shared by the `font-size` matcher. */
const SIZE_STEPS = "2xs|xs|sm|base|lg|xl|2xl|3xl|display";

/**
 * Ordered group table. First match wins, so order is load-bearing:
 * `text-lg` must be read as a size before `text-` claims it as a colour, and a
 * border *width* must be read before `border-` claims it as a colour.
 *
 * A group value is either a literal key or a function of the match, which is how
 * per-axis utilities (`px` vs `py`, `border-t` vs `border-b`) stay independent
 * instead of displacing one another.
 *
 * @type {ReadonlyArray<[RegExp, string | ((m: RegExpMatchArray) => string)]>}
 */
const GROUPS = [
  [new RegExp(`^text-(${SIZE_STEPS})$`), "font-size"],
  [/^text-(start|end|center|justify|left|right)$/, "text-align"],
  [/^text-/, "text-color"],

  // Widths first, including the per-side forms, then per-side colours, then the
  // plain colour. `border` and `border-2` share a group; `border-t-2` does not
  // share one with `border-b-2`.
  [
    /^border(?:-(t|r|b|l|x|y|s|e))?(?:-(\d+|\[[^\]]*\]))?$/,
    (m) => (m[1] ? `border-width-${m[1]}` : "border-width"),
  ],
  [/^border-(t|r|b|l|x|y|s|e)-/, (m) => `border-color-${m[1]}`],
  [/^border-/, "border-color"],

  [/^bg-/, "bg-color"],
  [/^(rounded)(-|$)/, "radius"],
  [/^(px|py|pt|pr|pb|pl|ps|pe|p)-/, (m) => `pad-${m[1]}`],
  [/^(mx|my|mt|mr|mb|ml|ms|me|m)-/, (m) => `margin-${m[1]}`],
  [/^(gap-x|gap-y|gap)-/, (m) => m[1]],
  [/^(min-w|min-h|max-w|max-h|w|h)-/, (m) => m[1]],
  [/^(font)-(sans|mono|display)$/, "font-family"],
  [/^font-/, "font-weight"],
  [/^(shadow)(-|$)/, "shadow"],
  [/^(ring-offset|ring)(-|$)/, (m) => m[1]],
  [
    /^(flex|grid|block|inline|inline-block|inline-flex|inline-grid|hidden|table|contents)$/,
    "display",
  ],
  [/^(items|justify|self|content|place)-/, (m) => m[1]],
];

/**
 * Split a token into its variant prefix and its base utility.
 *
 * The prefix is kept in the group key, so `hover:bg-accent-hover` cannot
 * displace `bg-primary` and `md:p-loose` cannot displace `p-snug`. Colons inside
 * an arbitrary value (`bg-[url(a:b)]`) are not separators, so the scan tracks
 * bracket depth rather than using `split(':')`.
 *
 * @param {string} token
 * @returns {{ variant: string, base: string }}
 */
function splitVariant(token) {
  let depth = 0;
  let cut = -1;
  for (let i = 0; i < token.length; i += 1) {
    const ch = token[i];
    if (ch === "[" || ch === "(") depth += 1;
    else if (ch === "]" || ch === ")") depth -= 1;
    else if (ch === ":" && depth === 0) cut = i;
  }
  return cut === -1
    ? { variant: "", base: token }
    : { variant: token.slice(0, cut + 1), base: token.slice(cut + 1) };
}

/**
 * The group a base utility belongs to, or `null` when the table does not
 * recognise it. `!` is stripped for grouping only — never from the output.
 *
 * @param {string} base
 * @returns {string | null}
 */
function groupOf(base) {
  const bare = base.replace(/^!/, "").replace(/!$/, "");
  for (const [pattern, group] of GROUPS) {
    const match = bare.match(pattern);
    if (match) return typeof group === "function" ? group(match) : group;
  }
  return null;
}

/**
 * Flatten class values into a single space-separated string. Falsy entries are
 * dropped; arrays nest; a record contributes each key whose value is truthy.
 *
 * @param {...unknown} inputs
 * @returns {string}
 */
export function cx(...inputs) {
  const out = [];
  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === "string" || typeof input === "number") {
      out.push(String(input));
    } else if (Array.isArray(input)) {
      const nested = cx(...input);
      if (nested) out.push(nested);
    } else if (typeof input === "object") {
      for (const [key, active] of Object.entries(input)) {
        if (active) out.push(key);
      }
    }
  }
  return out.join(" ");
}

/**
 * Flatten *and* resolve conflicts: within one group the later class wins and
 * takes the earlier class's position.
 *
 * Keeping the position rather than appending makes the output a deterministic
 * function of the input. Anything the table does not recognise is given a unique
 * key and always survives — the failure mode is "two conflicting classes both
 * present", which is today's behaviour, and never "a class silently vanished".
 *
 * @param {...unknown} inputs
 * @returns {string}
 */
export function mergeClasses(...inputs) {
  /** @type {Map<string, number>} groupKey -> index in `out` */
  const seen = new Map();
  /** @type {string[]} */
  const out = [];

  for (const token of cx(...inputs).split(/\s+/).filter(Boolean)) {
    const { variant, base } = splitVariant(token);
    const group = groupOf(base);
    const key = group === null ? `~unique:${out.length}` : `${variant}${group}`;
    const at = seen.get(key);
    if (at === undefined) {
      seen.set(key, out.length);
      out.push(token);
    } else {
      out[at] = token;
    }
  }

  return out.join(" ");
}

/**
 * Build a pure class recipe from a base string, a variant map, defaults and
 * optional compound rules. The returned function is a pure function of its
 * props, which is what makes a recipe testable without rendering anything.
 *
 * A variant group keyed `true`/`false` is addressed with a boolean prop; the
 * lookup stringifies, so `interactive: true` selects `variants.interactive.true`.
 *
 * `className` is merged last, so a call site always outranks the recipe.
 *
 * @param {{
 *   base: string,
 *   variants: Record<string, Record<string, string>>,
 *   defaults?: Record<string, unknown>,
 *   compound?: Array<{ when: Record<string, unknown>, use: string }>,
 * }} config
 * @returns {(props?: Record<string, unknown>) => string}
 */
export function variants(config) {
  const { base, variants: groups, defaults = {}, compound = [] } = config;

  return function recipe(props = {}) {
    /** @type {Record<string, string | undefined>} */
    const resolved = {};
    const parts = [base];

    for (const name of Object.keys(groups)) {
      const raw = props[name] === undefined ? defaults[name] : props[name];
      if (raw === undefined || raw === null) continue;
      const value = String(raw);
      resolved[name] = value;
      const classes = groups[name][value];
      if (classes) parts.push(classes);
    }

    for (const rule of compound) {
      const matches = Object.entries(rule.when).every(
        ([name, expected]) => resolved[name] === String(expected),
      );
      if (matches) parts.push(rule.use);
    }

    if (props.className) parts.push(String(props.className));

    return mergeClasses(...parts);
  };
}
