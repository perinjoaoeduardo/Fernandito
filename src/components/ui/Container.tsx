import { clsx } from "clsx";
import type { JSX, ReactNode } from "react";

type ContainerProps = {
  children: ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
};

export function Container({ children, className, as: Tag = "div" }: ContainerProps) {
  return (
    <Tag className={clsx("mx-auto w-full max-w-6xl px-6 sm:px-8 lg:px-12", className)}>
      {children}
    </Tag>
  );
}
