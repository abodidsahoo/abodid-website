import { pages } from "../../lib/siteNavigation.js";

export const headers = [
  { id: "masthead", name: "Masthead", links: ["work", "research", "writing", "about"], action: pages.contact },
  { id: "studio", name: "Studio Bar", links: ["work", "services", "workshops"], action: { label: "Start a project", href: "#enquiry" } },
  { id: "journal", name: "Journal", links: ["writing", "digest", "vault"], action: pages.newsletter },
  { id: "gallery", name: "Gallery Strip", links: ["photography", "films", "lab"], action: { label: "All work", href: "/work" } },
];

export const menus = [
  { id: "directory", name: "Directory", title: "Site directory" },
  { id: "drawer", name: "Section Drawer", title: "Browse sections" },
  { id: "finder", name: "Page Finder", title: "Find a page" },
  { id: "visual", name: "Visual Index", title: "Visual index" },
];
