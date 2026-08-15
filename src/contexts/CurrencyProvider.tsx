import { useState, useCallback, useMemo, type ReactNode } from "react";
import { CURRENCIES, CurrencyContext, VX_PER_USD } from "./CurrencyContext";

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currencyCode, setCurrencyCode] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("visionex-currency") || "USD";
    }
    return "USD";
  });

  const currency = useMemo(
    () => CURRENCIES.find((c) => c.code === currencyCode) || CURRENCIES[0],
    [currencyCode]
  );

  const setCurrency = useCallback((code: string) => {
    setCurrencyCode(code);
    localStorage.setItem("visionex-currency", code);
  }, []);

  const vxToLocal = useCallback(
    (vx: number): string => {
      const usd = vx / VX_PER_USD;
      const local = usd * currency.rateToUsd;
      // Format nicely
      const formatted = local >= 1000
        ? local.toLocaleString(undefined, { maximumFractionDigits: 0 })
        : local.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `≈ ${currency.symbol}${formatted}`;
    },
    [currency]
  );

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, vxToLocal }}>
      {children}
    </CurrencyContext.Provider>
  );
}
