import { Button } from "@/components/ui/Button";

export function CTASection() {
  return (
    <section
      id="onde-encontrar"
      className="bg-fernandito-verde-medio flex min-h-screen flex-col items-center justify-center gap-8 px-6"
    >
      <h2 className="text-display-xl text-fernandito-off-white text-center font-serif">CTA</h2>
      <Button
        as="a"
        href="https://wa.me/"
        variant="whatsapp"
        target="_blank"
        rel="noopener noreferrer"
      >
        Fale no WhatsApp
      </Button>
    </section>
  );
}

export default CTASection;
