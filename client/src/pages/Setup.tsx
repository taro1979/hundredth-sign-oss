import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Link } from "wouter";

export default function Setup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const status = trpc.auth.setupStatus.useQuery(undefined, { retry: false });
  const setup = trpc.auth.setupAdmin.useMutation({
    onSuccess: () => {
      window.location.href = "/dashboard";
    },
  });

  if (status.data && !status.data.needsSetup) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold">Initial setup is complete</h1>
          <Link href="/login" className="mt-4 inline-block text-emerald-700 underline">Go to sign in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <form
        className="mx-auto w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          setup.mutate({ name, email, password });
        }}
      >
        <h1 className="text-2xl font-semibold tracking-tight">Initial admin setup</h1>
        <p className="mt-1 text-sm text-slate-500">Create the first administrator for this self-hosted instance.</p>
        <label className="mt-6 block text-sm font-medium">Name</label>
        <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
        <label className="mt-4 block text-sm font-medium">Email</label>
        <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
        <label className="mt-4 block text-sm font-medium">Password</label>
        <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
        <p className="mt-2 text-xs text-slate-500">Use at least 10 characters.</p>
        {setup.error ? <p className="mt-3 text-sm text-red-600">{setup.error.message}</p> : null}
        <button className="mt-6 w-full rounded-md bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60" disabled={setup.isPending}>
          {setup.isPending ? "Creating..." : "Create admin"}
        </button>
      </form>
    </main>
  );
}
