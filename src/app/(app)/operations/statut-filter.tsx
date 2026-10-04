"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function StatutFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <div>
      <label className="label" htmlFor="f-statut">Statut</label>
      <select
        id="f-statut"
        className="input w-40"
        value={params.get("statut") ?? ""}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          if (e.target.value) next.set("statut", e.target.value);
          else next.delete("statut");
          router.push(`${pathname}?${next}`);
        }}
      >
        <option value="">Toutes</option>
        <option value="a_valider">À valider</option>
        <option value="validees">Validées</option>
      </select>
    </div>
  );
}
