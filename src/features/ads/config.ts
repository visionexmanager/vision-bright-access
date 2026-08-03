const clean = (value: string | undefined) => value?.trim().replace(/^['"]|['"]$/g, "") ?? "";

export const adsConfig = {
  adsenseClient: clean(import.meta.env.VITE_ADSENSE_CLIENT) || "ca-pub-6897088904832302",
  adsenseResponsiveSlot: clean(import.meta.env.VITE_ADSENSE_RESPONSIVE_SLOT),
  gamNetworkCode: clean(import.meta.env.VITE_GAM_NETWORK_CODE),
  gamRewardedUnit: clean(import.meta.env.VITE_GAM_REWARDED_UNIT),
};

export const isAdSenseConfigured = () =>
  /^ca-pub-\d{10,}$/.test(adsConfig.adsenseClient) &&
  /^\d+$/.test(adsConfig.adsenseResponsiveSlot);

export const isRewardedAdsConfigured = () =>
  /^\d+$/.test(adsConfig.gamNetworkCode) && adsConfig.gamRewardedUnit.length > 0;

