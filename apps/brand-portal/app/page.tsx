import Link from "next/link";
import { Shell } from "@/components/Shell";
import { apiGet } from "@/lib/api";
import type { Brand } from "@/lib/types";

export default async function HomePage() {
  let brands: Brand[] = [];
  try {
    brands = await apiGet<Brand[]>("/brands");
  } catch {
    brands = [];
  }

  return (
    <Shell>
      <div className="p-10 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="font-display text-3xl font-bold text-slate-900">Your brands</h1>
            <p className="text-slate-500 mt-1">Select a brand or create a new workspace.</p>
          </div>
          <Link
            href="/brands/new"
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-500 transition"
          >
            Add new brand
          </Link>
        </div>
        {brands.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-16 text-center">
            <p className="text-slate-600 mb-4">No brands yet — seed data appears after first compose up.</p>
            <Link href="/brands/new" className="text-indigo-600 font-semibold hover:underline">
              Create your first brand
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {brands.map((b) => (
              <Link
                key={b.id}
                href={`/brands/${b.id}`}
                className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 hover:shadow-md transition duration-200"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="h-14 w-14 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center text-lg font-bold text-slate-500"
                    style={{ backgroundColor: `${b.color_primary}22` }}
                  >
                    {b.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.logo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      b.name.slice(0, 1)
                    )}
                  </div>
                  <div>
                    <h2 className="font-display font-semibold text-lg text-slate-900 group-hover:text-indigo-600">
                      {b.name}
                    </h2>
                    <p className="text-xs text-slate-500 capitalize">{b.tone}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
