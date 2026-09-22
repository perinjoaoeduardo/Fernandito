import { WhatsAppButton } from "@/components/ui/WhatsAppButton";

export function CTASection() {
  return (
    <section
      id="onde-encontrar"
      className="bg-fernandito-verde-medio flex min-h-screen flex-col items-center justify-center gap-8 px-6"
    >
      <h2 className="text-display-xl text-fernandito-off-white text-center font-serif">CTA</h2>
      <WhatsAppButton>Fale no WhatsApp</WhatsAppButton>
    </section>
  );
}

export default CTASection;
