import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { apiGet } from "@/lib/api";
import type { Campaign, Creative, Product } from "@/lib/types";
import { CampaignManage } from "./CampaignManage";

export default async function CampaignPage({ params }: { params: { id: string } }) {
  let campaign: Campaign;
  let products: Product[];
  let creatives: Creative[];
  try {
    campaign = await apiGet<Campaign>(`/campaigns/${params.id}`);
    products = await apiGet<Product[]>(`/campaigns/${params.id}/products`);
    creatives = await apiGet<Creative[]>(`/campaigns/${params.id}/creatives`);
  } catch {
    notFound();
  }

  return (
    <Shell>
      <div className="p-10 max-w-6xl mx-auto">
        <CampaignManage initialCampaign={campaign} initialProducts={products} initialCreatives={creatives} />
      </div>
    </Shell>
  );
}
