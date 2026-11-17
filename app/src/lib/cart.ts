/* Panier gardé sur l'appareil jusqu'au paiement. */
import { useEffect, useState } from "react";
import type { CartLine } from "./backend";
import { read, write } from "./storage";

const K = "app.cart.v1";
let lines: CartLine[] = read<CartLine[]>(K) || [];
const subs = new Set<() => void>();
function set(next: CartLine[]) { lines = next; write(K, lines); subs.forEach((f) => f()); }

export const cart = {
  get: () => lines,
  add(product_id: string, comment = "") {
    // une ligne par commentaire : deux dédicaces différentes restent deux lignes
    const i = lines.findIndex((l) => l.product_id === product_id && l.comment === comment);
    if (i >= 0) set(lines.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l)));
    else set([...lines, { product_id, qty: 1, comment }]);
  },
  setQty(index: number, qty: number) { set(qty <= 0 ? lines.filter((_, j) => j !== index) : lines.map((l, j) => (j === index ? { ...l, qty } : l))); },
  clear() { set([]); }
};

export function useCart() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return lines;
}
