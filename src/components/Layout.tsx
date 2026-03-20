import { ReactNode } from "react";
import { Navbar } from "./Navbar";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="border-t bg-card py-8 text-center" role="contentinfo">
        <p className="text-muted-foreground">
          &copy; {new Date().getFullYear()} Visionex. Built for everyone.
        </p>
      </footer>
    </div>
  );
}
