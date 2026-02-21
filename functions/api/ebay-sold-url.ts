export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const encoded = encodeURIComponent(q);
  // eBay sold+completed search URL on ebay.ca
  const soldUrl = `https://www.ebay.ca/sch/i.html?_nkw=${encoded}&LH_Sold=1&LH_Complete=1&rt=nc`;
  return Response.json({ soldUrl }, { headers: { "Cache-Control": "no-store" } });
};
