import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AD_CONSENT_EVENT, readConsent } from "./consent";
import { isAdEligiblePath } from "./policy";

export function useAdEligibility() {
  const { pathname } = useLocation();
  const [advertisingConsent, setAdvertisingConsent] = useState(() => readConsent()?.advertising === true);

  useEffect(() => {
    const update = () => setAdvertisingConsent(readConsent()?.advertising === true);
    window.addEventListener(AD_CONSENT_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(AD_CONSENT_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return { pathname, advertisingConsent, routeEligible: isAdEligiblePath(pathname) };
}

