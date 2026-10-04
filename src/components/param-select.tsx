"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** A select bound to one URL search param. */
export function ParamSelect({
  name,
  label,
  options,
  placeholder,
  className = "w-48",
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <div>
      <label className="label" htmlFor={`p-${name}`}>{label}</label>
      <select
        id={`p-${name}`}
        className={`input ${className}`}
        value={params.get(name) ?? ""}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          if (e.target.value) next.set(name, e.target.value);
          else next.delete(name);
          router.push(`${pathname}?${next}`, { scroll: false });
        }}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
