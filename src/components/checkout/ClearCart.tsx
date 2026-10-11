"use client";

import { useEffect } from "react";
import { useCart } from "@/components/cart/CartProvider";

/** Pedido pago → esvazia o carrinho (localStorage) uma vez. */
export function ClearCart() {
  const { clear, ready } = useCart();
  useEffect(() => {
    if (ready) clear();
  }, [ready, clear]);
  return null;
}
