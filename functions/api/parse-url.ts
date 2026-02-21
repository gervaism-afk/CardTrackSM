export const onRequestPost: PagesFunction = async (ctx) => {
  try {
    const body = await ctx.request.json().catch(() => null) as any;
    const url = body?.url as string;
    if (!url || typeof url !== "string") {
      return new Response('Expected JSON body: {"url":"https://..."}', { status: 400 });
    }
    if (!/^https?:\/\//i.test(url)) {
      return new Response("URL must start with http:// or https://", { status: 400 });
    }

    const readerUrl = "https://r.jina.ai/" + url;
    const resp = await fetch(readerUrl, { headers: { "accept": "text/plain" }});
    if (!resp.ok) {
      const t = await resp.text();
      return new Response(`Reader fetch failed: ${t}`, { status: 502 });
    }
    const text = await resp.text();

    // Try to get a title from markdown
    let title = "";
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^#\s+(.+)\s*$/);
      if (m) { title = m[1].trim(); break; }
    }
    if (!title) {
      // fallback: first non-empty line
      const first = text.split(/\r?\n/).find(l => l.trim().length > 0);
      title = (first || "").trim().slice(0, 200);
    }

    // Return a small excerpt for debugging
    const excerpt = text.slice(0, 4000);

    return new Response(JSON.stringify({ title, excerpt }), {
      headers: { "content-type": "application/json" }
    });
  } catch (e: any) {
    return new Response(String(e?.message || e), { status: 500 });
  }
};