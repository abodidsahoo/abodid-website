import countries from "./countries.json";
const countryCodes = new Set(countries.map((c) => c.code));
export interface Nomination {
  name: string;
  city: string;
  country: string;
  link: string;
  latitude: number | null;
  longitude: number | null;
}
export function nominationInput(body: Record<string, unknown>): Nomination {
  const text = (key: string, max: number) =>
    typeof body[key] === "string"
      ? (body[key] as string).trim().slice(0, max)
      : "";
  const name = text("name", 120),
    city = text("city", 160),
    country = text("country", 2),
    link = text("link", 500);
  if (name.length < 2) throw Error("Please add the artist’s name.");
  if (!countryCodes.has(country)) throw Error("Please choose a country.");
  if (
    !link ||
    (!/^@[\w.\-]{1,100}$/.test(link) && !/^https:\/\/[^\s]+$/i.test(link))
  )
    throw Error("Add an HTTPS website/social link or an @handle.");
  const latitude =
    typeof body.latitude === "number" && Number.isFinite(body.latitude)
      ? body.latitude
      : null;
  const longitude =
    typeof body.longitude === "number" && Number.isFinite(body.longitude)
      ? body.longitude
      : null;
  if (
    (latitude === null) !== (longitude === null) ||
    (latitude !== null && Math.abs(latitude) > 90) ||
    (longitude !== null && Math.abs(longitude) > 180)
  )
    throw Error("Please select a valid location or leave it blank.");
  return { name, city, country, link, latitude, longitude };
}
export function publicName(value: unknown) {
  if (typeof value !== "string") throw Error("Choose a public name.");
  const name = value.trim().replace(/\s+/g, " ");
  if (
    name.length < 2 ||
    name.length > 40 ||
    !/[\p{L}\p{N}]/u.test(name) ||
    /[<>@:/\\\n\r]/.test(name)
  )
    throw Error(
      "Use a name of 2–40 characters, without links or contact details.",
    );
  return name;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return (
    (!origin || origin === new URL(request.url).origin) &&
    request.headers.get("sec-fetch-site") !== "cross-site"
  );
}
