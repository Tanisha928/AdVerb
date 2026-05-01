"use client";

import { useMemo, useState } from "react";

import type { AdRequest } from "../lib/types";

type PrefillProfile = {
  age: number;
  locationStr: string;
  interests: number[];
};

const AGE_GROUPS = ["18-24", "25-34", "35-44", "45+"] as const;

const PRIMARY_INTERESTS = [
  { label: "Running", index: 0 },
  { label: "Gym & Lifting", index: 1 },
  { label: "Fashion", index: 8 },
  { label: "Wearables", index: 9 },
  { label: "Outdoor", index: 7 },
  { label: "Basketball", index: 4 },
  { label: "Soccer", index: 5 },
  { label: "Wellness", index: 10 },
] as const;

const SHOPPING_OCCASIONS = ["Treating myself", "Buying a gift", "Just browsing", "Ready to buy"] as const;

export function AdForm({
  onSubmit,
  prefill,
}: {
  onSubmit: (req: AdRequest) => void;
  prefill?: Partial<PrefillProfile>;
}) {
  const normalizedInterests = useMemo(() => {
    const source = prefill?.interests?.length === 12 ? prefill.interests : Array(12).fill(0);
    const firstSelected = source.findIndex((v) => v === 1);
    if (firstSelected < 0) return source;
    return source.map((_, idx) => (idx === firstSelected ? 1 : 0));
  }, [prefill?.interests]);

  const initialAgeGroup =
    prefill?.age !== undefined
      ? prefill.age < 25
        ? "18-24"
        : prefill.age < 35
          ? "25-34"
          : prefill.age < 45
            ? "35-44"
            : "45+"
      : "25-34";
  const initialInterestIdx = Math.max(0, normalizedInterests.findIndex((v) => v === 1));
  const [ageGroup, setAgeGroup] = useState<(typeof AGE_GROUPS)[number]>(initialAgeGroup);
  const [locationStr, setLocationStr] = useState(prefill?.locationStr ?? "New York");
  const [selectedInterestIndex, setSelectedInterestIndex] = useState<number>(initialInterestIdx);
  const [shoppingOccasion, setShoppingOccasion] = useState<(typeof SHOPPING_OCCASIONS)[number]>("Just browsing");
  const device = useMemo(() => {
    if (typeof navigator === "undefined") return 1; // default desktop
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 0 : 1;
  }, []);
  const ageBucket = AGE_GROUPS.indexOf(ageGroup);
  const locationId = useMemo(() => ["New York", "San Jose", "London", "Chicago", "Los Angeles"].indexOf(locationStr), [locationStr]);
  const interests = useMemo(() => {
    const next = Array(12).fill(0);
    next[PRIMARY_INTERESTS[selectedInterestIndex]?.index ?? 0] = 1;
    return next;
  }, [selectedInterestIndex]);

  return (
    <form
      className="panel space-y-6 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          userId: crypto.randomUUID(),
          ageBucket,
          interests,
          locationId: Math.max(0, locationId),
          locationStr,
          ageGroup,
          device,
          shoppingOccasion,
        });
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="field-label">Age Group</span>
          <select className="input-control" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value as (typeof AGE_GROUPS)[number])}>
            {AGE_GROUPS.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Location</span>
          <input
            className="input-control"
            type="text"
            value={locationStr}
            placeholder="e.g. San Jose, New York, Chicago"
            onChange={(e) => setLocationStr(e.target.value)}
          />
        </label>
      </div>

      <fieldset>
        <legend className="field-label">Primary Interest</legend>
        <select className="input-control" value={selectedInterestIndex} onChange={(e) => setSelectedInterestIndex(Number(e.target.value))}>
          {PRIMARY_INTERESTS.map((item, idx) => (
            <option key={item.label} value={idx}>
              {item.label}
            </option>
          ))}
        </select>
      </fieldset>

      <fieldset>
        <legend className="field-label">Shopping Occasion</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {SHOPPING_OCCASIONS.map((occasion) => (
            <label
              key={occasion}
              className={[
                "cursor-pointer rounded-xl border px-3 py-2 text-sm transition",
                shoppingOccasion === occasion
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 text-slate-700 hover:bg-slate-100",
              ].join(" ")}
            >
              <input className="sr-only" type="radio" checked={shoppingOccasion === occasion} onChange={() => setShoppingOccasion(occasion)} />
              {occasion}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-600">
          Target profile: <span className="font-medium text-slate-900">{ageGroup}</span> •{" "}
          <span className="font-medium text-slate-900">{device === 0 ? "mobile" : "desktop"}</span>
        </p>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          Run Ad Auction
        </button>
      </div>
    </form>
  );
}
