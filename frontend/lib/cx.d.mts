export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | Record<string, unknown>
  | ClassValue[];

/** Flatten class values into one space-separated string. */
export declare function cx(...inputs: ClassValue[]): string;

/**
 * Flatten and resolve conflicts: within a group the later class wins and takes
 * the earlier class's position. Unrecognised utilities always survive.
 */
export declare function mergeClasses(...inputs: ClassValue[]): string;

/** A variant map: group name -> variant value -> class string. */
export type VariantMap = Record<string, Record<string, string>>;

/**
 * Props accepted by a recipe. A group keyed `true`/`false` is addressed with a
 * boolean; every other group is addressed by its value name.
 */
export type VariantProps<V extends VariantMap> = {
  [K in keyof V]?: keyof V[K] extends "true" | "false" ? boolean : keyof V[K];
};

export interface VariantConfig<V extends VariantMap> {
  base: string;
  variants: V;
  defaults?: VariantProps<V>;
  compound?: Array<{ when: VariantProps<V>; use: string }>;
}

/** Build a pure class recipe. `className` is merged last, so a call site wins. */
export declare function variants<V extends VariantMap>(
  config: VariantConfig<V>,
): (props?: VariantProps<V> & { className?: string }) => string;
