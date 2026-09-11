import type { APIRoute } from "astro";
import { getApprovedResources } from "../lib/resources/db";
import { curationPath, curationUrl } from "../lib/curationRoutes.js";
import {
  buildSitemapXml,
  createXmlResponse,
  type SitemapEntry,
} from "../lib/sitemapHelper";

export const prerender = false;

export const GET: APIRoute = async () => {
  const resources = await getApprovedResources().catch(() => []);
  const entries: SitemapEntry[] = [
    { url: curationUrl(curationPath.home) },
  ];
  const curatorUrls = new Set<string>();

  for (const resource of resources) {
    entries.push({
      url: curationUrl(curationPath.resource(resource.id)),
      lastmod: resource.updated_at || resource.created_at,
    });

    const username = resource.submitter_profile?.username;
    if (username) curatorUrls.add(curationUrl(curationPath.curator(username)));
  }

  for (const url of curatorUrls) entries.push({ url });

  return createXmlResponse(buildSitemapXml(entries), 300);
};
