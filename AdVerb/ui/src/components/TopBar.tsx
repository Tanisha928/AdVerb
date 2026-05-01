export function TopBar({
  signedIn = false,
  onSignIn,
  onCreateAccount,
  onSignOut,
}: {
  signedIn?: boolean;
  onSignIn?: () => void;
  onCreateAccount?: () => void;
  onSignOut?: () => void;
}) {
  return (
    <header className="mb-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">AI Native Ad Studio</p>
        <h1 className="text-xl font-semibold text-slate-900">Adverb</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          System online
        </div>
        {signedIn ? (
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            Sign out
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onSignIn}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={onCreateAccount}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              Create account
            </button>
          </>
        )}
      </div>
    </header>
  );
}
