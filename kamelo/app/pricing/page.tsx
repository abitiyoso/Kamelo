import { Header, Footer } from "@/components/brand";
import { Pricing } from "@/components/pricing";
export default function Page() {
  return (
    <>
      <Header />
      <main>
        <Pricing />
      </main>
      <Footer />
    </>
  );
}
