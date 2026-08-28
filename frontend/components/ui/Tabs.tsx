import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { mergeClasses } from "@/lib/cx.mjs";

interface TabsContextValue {
  activeValue: string;
  setActiveValue: (value: string) => void;
  register: (value: string) => () => void;
  values: () => string[];
  baseId: string;
}
const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) throw new Error("Tab components must be used inside Tabs.");
  return context;
}

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}

export default function Tabs({
  value,
  defaultValue = "",
  onValueChange,
  children,
}: TabsProps): ReactElement {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [registeredValues, setRegisteredValues] = useState<string[]>([]);
  const baseId = useId();
  const requestedValue = value ?? internalValue;
  const activeValue = registeredValues.includes(requestedValue)
    ? requestedValue
    : (registeredValues[0] ?? requestedValue);

  const setActiveValue = useCallback((nextValue: string) => {
    if (value === undefined) setInternalValue(nextValue);
    onValueChange?.(nextValue);
  }, [onValueChange, value]);
  const register = useCallback((tabValue: string) => {
    setRegisteredValues((current) => current.includes(tabValue) ? current : [...current, tabValue]);
    return () => {
      setRegisteredValues((current) => current.filter((item) => item !== tabValue));
    };
  }, []);
  const values = useCallback(() => [...registeredValues], [registeredValues]);
  const context = useMemo(() => ({ activeValue, setActiveValue, register, values, baseId }), [activeValue, baseId, register, setActiveValue, values]);

  return <TabsContext.Provider value={context}>{children}</TabsContext.Provider>;
}

export interface TabListProps extends ComponentPropsWithRef<"div"> { label: string }
export function TabList({ label, className, ...rest }: TabListProps): ReactElement {
  return <div role="tablist" aria-label={label} className={mergeClasses("flex overflow-x-auto border-b border-border", className)} {...rest} />;
}

export interface TabProps extends ComponentPropsWithRef<"button"> { value: string }
export function Tab({ value, className, children, onKeyDown, ...rest }: TabProps): ReactElement {
  const context = useTabsContext();
  const { register } = context;
  const selected = context.activeValue === value;
  const ref = useRef<HTMLButtonElement | null>(null);
  useEffect(() => register(value), [register, value]);

  const move = (event: KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    const values = context.values();
    const current = values.indexOf(value);
    let next = current;
    if (event.key === "ArrowRight") next = (current + 1) % values.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + values.length) % values.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = values.length - 1;
    else return;
    event.preventDefault();
    context.setActiveValue(values[next]);
    document.getElementById(`${context.baseId}-tab-${values[next]}`)?.focus();
  };

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      id={`${context.baseId}-tab-${value}`}
      aria-selected={selected}
      aria-controls={`${context.baseId}-panel-${value}`}
      tabIndex={selected ? 0 : -1}
      onClick={() => context.setActiveValue(value)}
      onKeyDown={move}
      className={mergeClasses(
        "relative shrink-0 border-b-2 px-base py-snug text-sm font-medium transition-colors duration-quick focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        selected ? "border-primary text-text" : "border-transparent text-text-muted hover:text-text",
        className,
      )}
      {...rest}
    >{children}</button>
  );
}

export interface TabPanelProps extends ComponentPropsWithRef<"div"> { value: string }
export function TabPanel({ value, className, ...rest }: TabPanelProps): ReactElement | null {
  const context = useTabsContext();
  if (context.activeValue !== value) return null;
  return <div role="tabpanel" id={`${context.baseId}-panel-${value}`} aria-labelledby={`${context.baseId}-tab-${value}`} tabIndex={0} className={mergeClasses("focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus", className)} {...rest} />;
}
