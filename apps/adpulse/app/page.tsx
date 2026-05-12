import Link from "next/link";

const DASHBOARDS = [
  {
    href: "/brands",
    title: "Brand Portal",
    description: "Create brands, launch campaigns, generate AI creatives, and review ad copy before going live.",
    icon: "🏷️",
    accent: "indigo",
  },
  {
    href: "/feed",
    title: "User Feed",
    description: "Experience the personalized ad feed as a demo user. See how interest targeting and MAB ranking work in real time.",
    icon: "📱",
    accent: "sky",
  },
  {
    href: "/admin",
    title: "Admin Dashboard",
    description: "Monitor platform KPIs, live events, campaign performance, and MAB convergence curves.",
    icon: "📊",
    accent: "teal",
  },
] as const;

const accentMap = {
  indigo: { card: "hover:ring-indigo-300 hover:shadow-indigo-50", icon: "bg-indigo-50 text-indigo-600", btn: "bg-indigo-600 hover:bg-indigo-500" },
  sky:    { card: "hover:ring-sky-300 hover:shadow-sky-50",       icon: "bg-sky-50 text-sky-600",       btn: "bg-sky-600 hover:bg-sky-500" },
  teal:   { card: "hover:ring-teal-300 hover:shadow-teal-50",     icon: "bg-teal-50 text-teal-700",     btn: "bg-teal-600 hover:bg-teal-500" },
};

export default function HomePage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-14">
          <h1 className="font-display text-4xl font-bold text-slate-900 sm:text-5xl">
            Welcome to <span className="text-indigo-600">adverb</span>
          </h1>
          <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
            An AI-powered ad platform. Choose a dashboard to get started.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {DASHBOARDS.map(({ href, title, description, icon, accent }) => {
            const a = accentMap[accent];
            return (
              <div
                key={href}
                className={`group rounded-2xl bg-white p-7 shadow-sm ring-1 ring-slate-100 hover:shadow-lg transition-all duration-200 ${a.card} flex flex-col`}
              >
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-2xl mb-5 ${a.icon}`}>
                  {icon}
                </div>
                <h2 className="font-display text-lg font-bold text-slate-900 mb-2">{title}</h2>
                <p className="text-sm text-slate-500 leading-relaxed flex-1">{description}</p>
                <Link
                  href={href}
                  className={`mt-6 inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition ${a.btn}`}
                >
                  Open →
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
