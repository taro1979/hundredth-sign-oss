import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Link } from "wouter";

function returnPath() {
  const value = new URLSearchParams(window.location.search).get("returnPath");
  return value && value.startsWith("/") ? value : "/dashboard";
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const setup = trpc.auth.setupStatus.useQuery(undefined, { retry: false });
  const login = trpc.auth.login.useMutation({
    onSuccess: () => {
      window.location.href = returnPath();
    },
  });

  if (setup.data?.needsSetup) {
    window.location.href = "/setup";
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <form
        className="mx-auto w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          login.mutate({ email, password });
        }}
      >
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">Use your local staff account.</p>
        <label className="mt-6 block text-sm font-medium">Email</label>
        <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
        <label className="mt-4 block text-sm font-medium">Password</label>
        <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
        {login.error ? <p className="mt-3 text-sm text-red-600">{login.error.message}</p> : null}
        <button className="mt-6 w-full rounded-md bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60" disabled={login.isPending}>
          {login.isPending ? "Signing in..." : "Sign in"}
        </button>
        <Link href="/forgot-password" className="mt-4 block text-center text-sm text-emerald-700 underline">
          Forgot password?
        </Link>
      </form>
    </main>
  );
}
