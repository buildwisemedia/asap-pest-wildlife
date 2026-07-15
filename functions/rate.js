export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const score = Number(url.searchParams.get("score"));

  if (score >= 5 && url.searchParams.get("go") === "1") {
    return Response.redirect(
      "https://search.google.com/local/writereview?placeid=ChIJV-ndmxkd9YgRcgzlBLBNemc",
      302,
    );
  }

  const assetUrl = new URL("/rate/index.html", url);
  return env.ASSETS.fetch(new Request(assetUrl, request));
}
