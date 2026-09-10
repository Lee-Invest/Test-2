import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        <div className="mt-8 max-w-none space-y-4 text-gray-600">{children}</div>
      </main>
      <Footer />
    </>
  );
}
