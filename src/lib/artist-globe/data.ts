export interface Artist {
  artist_number?: number;
  id: string;
  name: string;
  origin: string;
  current_city: string;
  country: string;
  latitude: number;
  longitude: number;
  disciplines: string[];
  tags: string[];
  biography: string;
  artist_statement: string;
  portfolio_url: string | null;
  instagram_url: string | null;
  public_email: string | null;
  artwork_urls: string[];
  sources: string[];
  is_demo: boolean;
}
const places: [string, string, string, number, number, string][] = [
  ["Mira Sen", "Kolkata", "India", 22.57, 88.36, "Textile & installation"],
  ["Theo Moss", "London", "United Kingdom", 51.51, -0.13, "Sculpture & sound"],
  ["Aya Mori", "Kyoto", "Japan", 35.01, 135.77, "Ceramics & printmaking"],
  [
    "Sol Rivera",
    "Mexico City",
    "Mexico",
    19.43,
    -99.13,
    "Painting & public art",
  ],
  ["Nia Vale", "Lagos", "Nigeria", 6.52, 3.38, "Photography & collage"],
  ["Luca Reed", "Berlin", "Germany", 52.52, 13.4, "Moving image & code"],
  ["Alma Costa", "São Paulo", "Brazil", -23.55, -46.63, "Sculpture & textiles"],
  ["Noor Ash", "Cairo", "Egypt", 30.04, 31.24, "Drawing & installation"],
  [
    "Iris Stone",
    "New York",
    "United States",
    40.71,
    -74.01,
    "Photography & sound",
  ],
  [
    "Kai Bloom",
    "Melbourne",
    "Australia",
    -37.81,
    144.96,
    "Digital art & performance",
  ],
  ["Lena Frost", "Reykjavík", "Iceland", 64.15, -21.94, "Land art & sculpture"],
  [
    "Zuri Field",
    "Cape Town",
    "South Africa",
    -33.92,
    18.42,
    "Printmaking & textiles",
  ],
  [
    "Sage Park",
    "Seoul",
    "South Korea",
    37.57,
    126.98,
    "Moving image & sculpture",
  ],
  [
    "Elio Lake",
    "Buenos Aires",
    "Argentina",
    -34.6,
    -58.38,
    "Painting & drawing",
  ],
  ["Rae Fern", "Vancouver", "Canada", 49.28, -123.12, "Sound & ecological art"],
  [
    "Uma Clay",
    "Wellington",
    "New Zealand",
    -41.29,
    174.78,
    "Ceramics & installation",
  ],
  ["Ari Wren", "Nairobi", "Kenya", -1.29, 36.82, "Public art & photography"],
  ["Remy Blue", "Paris", "France", 48.86, 2.35, "Painting & artist books"],
];
export const demoArtists: Artist[] = places.map(
  ([name, current_city, country, latitude, longitude, practice], i) => ({
    id: `demo-${String(i + 1).padStart(3, "0")}`,
    artist_number: i + 1,
    name,
    current_city,
    country,
    latitude,
    longitude,
    origin: current_city,
    disciplines: practice.split(" & "),
    tags: ["Material experiments", "Place & memory"],
    biography: `${name} is a fictional artist created to demonstrate this globe. This sample profile explores ${practice.toLowerCase()} through everyday materials, local stories, and the places we call home.`,
    artist_statement:
      "A sample statement: paying attention is the beginning of making. What might we discover in the familiar?",
    portfolio_url: null,
    instagram_url: null,
    public_email: null,
    artwork_urls: [],
    sources: [],
    is_demo: true,
  }),
);
export function validArtist(value: unknown): value is Artist {
  const a = value as Artist;
  return (
    !!a &&
    typeof a.id === "string" &&
    typeof a.name === "string" &&
    a.name.length > 0 &&
    typeof a.current_city === "string" &&
    typeof a.country === "string" &&
    Number.isFinite(a.latitude) &&
    Math.abs(a.latitude) <= 90 &&
    Number.isFinite(a.longitude) &&
    Math.abs(a.longitude) <= 180 &&
    Array.isArray(a.disciplines) &&
    a.disciplines.every((x) => typeof x === "string") &&
    Array.isArray(a.tags) &&
    a.tags.every((x) => typeof x === "string") &&
    ["origin", "biography", "artist_statement"].every(
      (key) => typeof a[key as keyof Artist] === "string",
    ) &&
    ["portfolio_url", "instagram_url", "public_email"].every(
      (key) =>
        a[key as keyof Artist] === null ||
        typeof a[key as keyof Artist] === "string",
    ) &&
    Array.isArray(a.artwork_urls) &&
    a.artwork_urls.every((x) => typeof x === "string") &&
    Array.isArray(a.sources) &&
    a.sources.every((x) => typeof x === "string") &&
    typeof a.is_demo === "boolean"
  );
}
export function safeUrl(value: string | null): string | undefined {
  try {
    const u = new URL(value || "");
    return u.protocol === "https:" ? u.href : undefined;
  } catch {
    return undefined;
  }
}
