const FOURSQUARE_API_VERSION = "2025-06-17";

export async function handler(event) {
  const apiKey =
    process.env.FOURSQUARE_API_KEY || process.env.VITE_FOURSQUARE_API_KEY;

  if (!apiKey) {
    return jsonResponse(500, {
      message:
        "Foursquare key missing. Add FOURSQUARE_API_KEY or VITE_FOURSQUARE_API_KEY in Netlify environment variables and redeploy.",
    });
  }

  const params = new URLSearchParams(event.queryStringParameters || {});
  const response = await fetch(
    `https://places-api.foursquare.com/places/search?${params.toString()}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Places-Api-Version": FOURSQUARE_API_VERSION,
      },
    }
  );

  const body = await response.text();
  return {
    statusCode: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") || "application/json",
      "Cache-Control": "public, max-age=300",
    },
    body,
  };
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
