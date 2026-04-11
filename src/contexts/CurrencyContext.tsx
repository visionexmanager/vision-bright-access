import { createContext, useContext, useState, ReactNode, useCallback, useMemo } from "react";

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  flag: string;
  rateToUsd: number; // How many units of this currency = 1 USD
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: "USD", symbol: "$", name: "US Dollar", flag: "🇺🇸", rateToUsd: 1 },
  { code: "EUR", symbol: "€", name: "Euro", flag: "🇪🇺", rateToUsd: 0.92 },
  { code: "GBP", symbol: "£", name: "British Pound", flag: "🇬🇧", rateToUsd: 0.79 },
  { code: "SAR", symbol: "ر.س", name: "Saudi Riyal", flag: "🇸🇦", rateToUsd: 3.75 },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", flag: "🇦🇪", rateToUsd: 3.67 },
  { code: "EGP", symbol: "ج.م", name: "Egyptian Pound", flag: "🇪🇬", rateToUsd: 48.5 },
  { code: "TRY", symbol: "₺", name: "Turkish Lira", flag: "🇹🇷", rateToUsd: 32.5 },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", flag: "🇧🇷", rateToUsd: 5.1 },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", flag: "🇨🇳", rateToUsd: 7.25 },
  { code: "RUB", symbol: "₽", name: "Russian Ruble", flag: "🇷🇺", rateToUsd: 92 },
  { code: "INR", symbol: "₹", name: "Indian Rupee", flag: "🇮🇳", rateToUsd: 83.5 },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", flag: "🇯🇵", rateToUsd: 155 },
  { code: "KWD", symbol: "د.ك", name: "Kuwaiti Dinar", flag: "🇰🇼", rateToUsd: 0.31 },
  { code: "QAR", symbol: "ر.ق", name: "Qatari Riyal", flag: "🇶🇦", rateToUsd: 3.64 },
  { code: "MAD", symbol: "د.م", name: "Moroccan Dirham", flag: "🇲🇦", rateToUsd: 10.1 },
  { code: "DZD", symbol: "د.ج", name: "Algerian Dinar", flag: "🇩🇿", rateToUsd: 135 },
  { code: "IQD", symbol: "ع.د", name: "Iraqi Dinar", flag: "🇮🇶", rateToUsd: 1310 },
  { code: "JOD", symbol: "د.أ", name: "Jordanian Dinar", flag: "🇯🇴", rateToUsd: 0.71 },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso", flag: "🇲🇽", rateToUsd: 17.2 },
  { code: "PKR", symbol: "₨", name: "Pakistani Rupee", flag: "🇵🇰", rateToUsd: 278 },
];

const VX_PER_USD = 1000;

interface CurrencyContextType {
  currency: CurrencyInfo;
  setCurrency: (code: string) => void;
  /** Convert VX amount to local currency string, e.g. "≈ $59.99" */
  vxToLocal: (vx: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: CURRENCIES[0],
  setCurrency: () => {},
  vxToLocal: () => "",
});

export const useCurrency = () => useContext(CurrencyContext);

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
