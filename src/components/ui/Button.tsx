import { clsx } from "clsx";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "whatsapp";

const variantClasses: Record<Variant, string> = {
  primary: "bg-fernandito-verde-escuro text-fernandito-off-white hover:opacity-90",
  ghost:
    "border border-fernandito-verde-medio text-fernandito-verde-escuro bg-transparent hover:bg-fernandito-verde-medio/10",
  whatsapp: "bg-fernandito-verde-medio text-fernandito-off-white hover:opacity-90",
};

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-sans text-body font-medium transition-colors duration-200";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-5 w-5">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.004 2.003c-5.514 0-9.997 4.483-9.997 9.997 0 1.763.462 3.484 1.34 5.002L2 22l5.126-1.345a9.958 9.958 0 0 0 4.878 1.242h.004c5.514 0 9.997-4.483 9.997-9.997 0-2.67-1.04-5.18-2.929-7.07a9.935 9.935 0 0 0-7.072-2.927zm0 18.16h-.003a8.19 8.19 0 0 1-4.174-1.143l-.3-.178-3.043.798.813-2.968-.196-.305a8.156 8.156 0 0 1-1.256-4.367c0-4.509 3.669-8.178 8.163-8.178a8.12 8.12 0 0 1 5.78 2.397 8.12 8.12 0 0 1 2.393 5.788c0 4.509-3.67 8.156-8.177 8.156z" />
    </svg>
  );
}

type ButtonAsButton = ButtonHTMLAttributes<HTMLButtonElement> & {
  as?: "button";
  href?: undefined;
};

type ButtonAsAnchor = AnchorHTMLAttributes<HTMLAnchorElement> & {
  as: "a";
  href: string;
};

type ButtonProps = (ButtonAsButton | ButtonAsAnchor) & {
  variant?: Variant;
  children: ReactNode;
  className?: string;
};

export function Button({ variant = "primary", children, className, ...props }: ButtonProps) {
  const classes = clsx(baseClasses, variantClasses[variant], className);
  const content = (
    <>
      {variant === "whatsapp" && <WhatsAppIcon />}
      {children}
    </>
  );

  if (props.as === "a") {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip custom `as` before spreading onto the DOM node
    const { as: _as, ...anchorProps } = props;
    return (
      <a className={classes} {...anchorProps}>
        {content}
      </a>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip custom `as` before spreading onto the DOM node
  const { as: _as, ...buttonProps } = props;
  return (
    <button className={classes} {...buttonProps}>
      {content}
    </button>
  );
}
