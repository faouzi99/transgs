import { requireUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/labels";
import { Nav, type NavItem } from "@/components/nav";
import { logoutAction } from "@/app/actions/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items: NavItem[] = [
    { href: "/", label: "Tableau de bord" },
    { href: "/materiel", label: "Recherche matériel" },
    ...(user.role !== "DIRECTION" ? [{ href: "/operations/nouvelle", label: "Saisie opération" }] : []),
    { href: "/operations", label: "Opérations" },
    { href: "/stock", label: "Stock lubrifiants" },
    { href: "/suivi", label: "Soufflage / graissage / lavage" },
    { href: "/analyses", label: "Analyses" },
    { href: "/rapports", label: "Rapports" },
    { href: "/consommation", label: "Consommation mensuelle" },
    ...(user.role === "ADMIN" ? [{ href: "/admin", label: "Administration" }] : []),
  ];
  return (
    <div className="min-h-screen lg:flex">
      <aside className="bg-ink px-3 py-3 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:overflow-y-auto">
        <div className="mb-3 flex items-center justify-between px-2 lg:block">
          <div className="text-xl font-black tracking-tight text-white">
            TRANS<span className="text-accent">WIN</span>
          </div>
          <div className="text-right text-xs text-slate-300 lg:mt-3 lg:text-left">
            <div className="font-semibold text-white">{user.nom}</div>
            <div>
              {ROLE_LABEL[user.role]}
              {user.siteNom ? ` · ${user.siteNom}` : " · Tous les sites"}
            </div>
            <form action={logoutAction} className="mt-1">
              <button className="text-accent hover:underline">Se déconnecter</button>
            </form>
          </div>
        </div>
        <Nav items={items} />
      </aside>
      <main className="min-w-0 flex-1 px-4 py-4 lg:px-6">{children}</main>
    </div>
  );
}
