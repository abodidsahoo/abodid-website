import { getPostBySlug, getNextPost, getRelatedPost } from "../../lib/api";
import { marked } from "marked";
import { renderBlocksToHtml } from "../../lib/blogBlockRenderer.js";

export const prerender = false;

export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");

  if (!slug) {
    return new Response(JSON.stringify({ error: "Missing slug parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const post = await getPostBySlug(slug);

    if (!post) {
      return new Response(JSON.stringify({ error: "Post not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const hasBlocks = Array.isArray(post.blocks) && post.blocks.length > 0;
    const contentHtml = hasBlocks
      ? renderBlocksToHtml(post.blocks)
      : await marked.parse(post.content || "");

    const primaryCategory = post?.category
      ? Array.isArray(post.category)
        ? post.category[0]
        : post.category
      : null;

    const [nextPost, relatedPost] = await Promise.all([
      getNextPost(slug),
      getRelatedPost(slug, primaryCategory),
    ]);

    return new Response(
      JSON.stringify({
        post,
        hasBlocks,
        contentHtml,
        nextPost,
        relatedPost,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60, s-maxage=300",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch post", details: String(error) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
