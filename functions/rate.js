const REVIEW_URL =
  "https://search.google.com/local/writereview?placeid=ChIJV-ndmxkd9YgRcgzlBLBNemc";

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const score = Number(url.searchParams.get("score"));

  if (score >= 5 && url.searchParams.get("go") === "1") {
    return Response.redirect(REVIEW_URL, 302);
  }

  // Serve the page content at /rate directly. Fetching "/rate/index.html"
  // through ASSETS returns the platform's 308 canonical-URL redirect, and the
  // function matches /rate and /rate/ — relaying that redirect loops forever.
  // "/rate/" is the canonical asset URL, so fetch it; follow one redirect as a
  // guard in case the canonical form ever changes.
  let response = await env.ASSETS.fetch(new Request(new URL("/rate/", url), request));
  if ([301, 302, 307, 308].includes(response.status)) {
    const location = response.headers.get("Location");
    if (location) {
      response = await env.ASSETS.fetch(new Request(new URL(location, url), request));
    }
  }
  return response;
}
