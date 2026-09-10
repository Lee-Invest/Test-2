import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { BuyChallengeForm } from "@/components/buy-challenge-form";

export default function BuyChallengePage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <BuyChallengeForm />
      </main>
      <Footer />
    </>
  );
}
