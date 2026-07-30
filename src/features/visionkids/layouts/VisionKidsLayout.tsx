import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import "@/features/visionkids/assets/visionkids.css";
import { SkipToContent } from "@/features/visionkids/components/SkipToContent";
import { TopNav } from "@/features/visionkids/components/TopNav";
import { Sidebar } from "@/features/visionkids/components/Sidebar";
import { UsageGate } from "@/features/visionkids/components/social/UsageGate";
import { applyStoredKidsAccessibilityPrefs } from "@/features/visionkids/utils/accessibilityPrefs";

export function VisionKidsLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    applyStoredKidsAccessibilityPrefs();
  }, []);

  // Close the mobile drawer on every navigation.
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="visionkids-root flex min-h-screen flex-col bg-background font-sans text-foreground">
      <SkipToContent />
      <TopNav onOpenSidebar={() => setMobileSidebarOpen(true)} />
      <div className="flex flex-1">
        <Sidebar mobileOpen={mobileSidebarOpen} onMobileOpenChange={setMobileSidebarOpen} />
        <main id="kids-main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          <UsageGate>
            <Outlet />
          </UsageGate>
        </main>
      </div>
    </div>
  );
}

export default VisionKidsLayout;
