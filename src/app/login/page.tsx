import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-3xl font-black tracking-tight text-ink">
            TRANS<span className="text-accent">WIN</span>
          </div>
          <p className="mt-1 text-sm text-muted">Suivi maintenance, engins et lubrifiants</p>
        </div>
        <div className="card shadow-sm">
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-xs text-muted">
          Pas de compte ? Les comptes sont créés uniquement par l&apos;administrateur.
        </p>
      </div>
    </main>
  );
}
