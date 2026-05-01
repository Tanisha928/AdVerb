export type VariantMeta = {
  variantId: string;
  templateSlug: string;
  brand: string;
  category: string;
  overlayKey: string;
  overlayUrl: string;
  backgroundUrl: string;
  colorScheme: { primary: string; secondary: string };
  interest: string;
  ageGroup: string;
  registeredAt: number;
};

const registry = new Map<string, VariantMeta>();

export function registerVariant(meta: VariantMeta): void {
  registry.set(meta.variantId, meta);
}

export function getVariantMeta(id: string): VariantMeta | undefined {
  return registry.get(id);
}

export function getAllVariantMeta(): VariantMeta[] {
  return [...registry.values()].sort((a, b) => b.registeredAt - a.registeredAt);
}
