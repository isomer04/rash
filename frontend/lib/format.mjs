const FORMATTERS = {
  currency: new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }),
  percent: new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }),
  plain: new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }),
};

export function signTone(value) {
  if (value > 0) {
    return {
      tone: "positive",
      className: "text-positive",
      icon: "trend-up",
      label: "up",
    };
  }
  if (value < 0) {
    return {
      tone: "negative",
      className: "text-negative",
      icon: "trend-down",
      label: "down",
    };
  }
  return {
    tone: "flat",
    className: "text-text-muted",
    icon: "trend-flat",
    label: "unchanged",
  };
}

export function formatCurrency(value) {
  return FORMATTERS.currency.format(value);
}

export function formatPercent(value) {
  return FORMATTERS.percent.format(value / 100);
}

export function formatPlain(value) {
  return FORMATTERS.plain.format(value);
}

export function formatFigure(value, format = "plain") {
  return format === "currency"
    ? formatCurrency(value)
    : format === "percent"
      ? formatPercent(value)
      : formatPlain(value);
}
