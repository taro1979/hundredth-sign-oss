import type { ReactNode } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface LegalPageLayoutProps {
  children: ReactNode;
}

export default function LegalPageLayout({ children }: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-16 print:py-8">
        <article className="prose prose-slate max-w-none print:prose-sm">
          {children}
        </article>
      </main>
      <Footer />
    </div>
  );
}
