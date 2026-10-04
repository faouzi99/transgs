"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function ProduitSensClient({
  products,
  showSens,
  produit,
  sens,
}: {
  products: { id: string; nom: string }[];
  showSens: boolean;
  produit?: string;
  sens?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set(k, v);
    else next.delete(k);
    router.push(`${pathname}?${next}`);
  };
  return (
    <>
      <div>
        <label className="label" htmlFor="f-produit">Produit</label>
        <select id="f-produit" className="input w-48" value={produit ?? ""} onChange={(e) => set("produit", e.target.value)}>
          <option value="">Tous</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.nom}</option>
          ))}
        </select>
      </div>
      {showSens && (
        <div>
          <label className="label" htmlFor="f-sens">Sens</label>
          <select id="f-sens" className="input w-32" value={sens ?? ""} onChange={(e) => set("sens", e.target.value)}>
            <option value="">Tous</option>
            <option value="ENTREE">Entrées</option>
            <option value="SORTIE">Sorties</option>
          </select>
        </div>
      )}
    </>
  );
}
