import { getAppToken, browseUrl, type EbayEnv } from "../_lib/ebay";

type ImgResult = {
  items: Array<{
    title: string;
    price?: { value: string; currency: string } | null;
    itemWebUrl?: string | null;
    image?: { imageUrl?: string } | null;
  }>;
  suggestedPriceCad?: number | null;
};

function median(nums: number[]) {
  const a = nums.slice().sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

export const onRequestPost: PagesFunction<EbayEnv> = async ({ request, env }) => {
  try {
    const { imageBase64 } = (await request.json()) as { imageBase64: string };
    if (!imageBase64) return new Response("Missing imageBase64", { status: 400 });

    const token = await getAppToken(env);

    const res = await fetch(browseUrl("/item_summary/search_by_image"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        // Force Canada marketplace (as requested)
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_CA",
      },
      body: JSON.stringify({
        image: imageBase64,
        limit: "10",
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      return new Response(`eBay search_by_image error: ${res.status} ${t}`, { status: 502 });
    }

    const data = (await res.json()) as any;
    const items = (data?.itemSummaries ?? []).map((it: any) => ({
      title: it?.title ?? "",
      price: it?.price ?? null,
      itemWebUrl: it?.itemWebUrl ?? null,
      image: it?.image ?? null,
    }));

    // "Suggested price" = median of listing prices converted to CAD if already CAD.
    // Note: Browse API returns active listings, not sold comps.
    const cadPrices: number[] = [];
    for (const it of items) {
      const p = it?.price;
      if (p && typeof p.value === "string") {
        const v = Number(p.value);
        if (!Number.isNaN(v)) cadPrices.push(v);
      }
    }

    const out: ImgResult = {
      items,
      suggestedPriceCad: cadPrices.length ? Number(median(cadPrices).toFixed(2)) : null,
    };

    return Response.json(out, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return new Response(e?.message ?? "Unknown error", { status: 500 });
  }
};
