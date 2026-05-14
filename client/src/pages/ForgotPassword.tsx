import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Link } from "wouter";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const reset = trpc.auth.requestPasswordReset.useMutation();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <form
        className="mx-auto w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          reset.mutate({ email });
        }}
      >
        <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
        <p className="mt-1 text-sm text-slate-500">Enter your staff email address.</p>
        <input className="mt-6 w-full rounded-md border border-slate-300 px-3 py-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
        <button className="mt-4 w-full rounded-md bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60" disabled={reset.isPending}>
          Send reset link
        </button>
        {reset.isSuccess ? <p className="mt-3 text-sm text-emerald-700">If the account exists, a reset link has been sent.</p> : null}
        <Link href="/login" className="mt-4 block text-center text-sm text-emerald-700 underline">Back to sign in</Link>
      </form>
    </main>
  );
}
