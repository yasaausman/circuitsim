import app from "../packages/api/src/app.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "localhost";
  const url = `${protocol}://${host}${req.url}`;

  const headers = new Headers();
  Object.entries(req.headers as Record<string, string | string[]>).forEach(([key, value]) => {
    if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  });

  let body: BodyInit | undefined;
  if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
    body = JSON.stringify(req.body);
    headers.set("content-type", "application/json");
  }

  const request = new Request(url, {
    method: req.method || "GET",
    headers,
    body,
  });

  const response = await app.fetch(request);

  res.status(response.status);
  response.headers.forEach((value: string, key: string) => {
    res.setHeader(key, value);
  });

  res.send(await response.text());
}
