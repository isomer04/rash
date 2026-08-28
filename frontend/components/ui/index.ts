/**
 * The single import path for UI primitives. Pages import from here, never from a
 * primitive's own module, so a recipe change lands everywhere at once.
 *
 * Primitives are added to this barrel as they are implemented.
 */
export { default as Button, buttonClass } from "@/components/ui/Button";
export type {
  ButtonProps,
  ButtonSize,
  ButtonVariant,
} from "@/components/ui/Button";

export {
  default as Card,
  cardClass,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
export type {
  CardPadding,
  CardProps,
  CardTitleProps,
  CardTone,
} from "@/components/ui/Card";

export { default as ThemeToggle } from "@/components/ui/ThemeToggle";
export type { ThemeToggleProps } from "@/components/ui/ThemeToggle";

export { default as Stat, StatGrid } from "@/components/ui/Stat";
export type { StatAlign, StatDeltaFormat, StatGridProps, StatProps, StatSize } from "@/components/ui/Stat";
export { default as Table, TableCell, TableHead, TableRoot, TableRow } from "@/components/ui/Table";
export type { Column, TableProps } from "@/components/ui/Table";
export { default as Badge, badgeClass } from "@/components/ui/Badge";
export type { BadgeProps, BadgeSize, BadgeTone } from "@/components/ui/Badge";
export { default as Tabs, Tab, TabList, TabPanel } from "@/components/ui/Tabs";
export type { TabListProps, TabPanelProps, TabProps, TabsProps } from "@/components/ui/Tabs";
export { default as Input, Field } from "@/components/ui/Input";
export type { InputProps } from "@/components/ui/Input";
export { default as Select } from "@/components/ui/Select";
export type { SelectOption, SelectProps } from "@/components/ui/Select";
export { default as Divider } from "@/components/ui/Divider";
export type { DividerProps } from "@/components/ui/Divider";
export { default as EmptyState } from "@/components/ui/EmptyState";
export type { EmptyStateProps } from "@/components/ui/EmptyState";
