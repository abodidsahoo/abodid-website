import React, { useEffect, useMemo, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { archiveAdminBlog, createAdminBlog, listAdminBlogs, reorderAdminBlogs } from "../../lib/blogAdmin";
import "../../styles/portfolio-admin.css"; // Reuse the portfolio-admin styles

const formatDate = (value) => value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Never";
const PUBLIC_ORDER_CHANNEL = "blog-public-order";

function announcePublicOrder(ids) {
  try {
    window.localStorage.setItem(PUBLIC_ORDER_CHANNEL, JSON.stringify({ ids, updatedAt: Date.now() }));
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(PUBLIC_ORDER_CHANNEL);
      channel.postMessage({ ids });
      channel.close();
    }
  } catch {
    // Persistence succeeded already; cross-tab refresh is a progressive enhancement.
  }
}

function BlogRow({ blog, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: blog.id, disabled });
  const title = blog.title || "Untitled post";
  return (
    <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .55 : 1 }} className="portfolio-admin-row">
      <button type="button" className="drag-handle" {...attributes} {...listeners} disabled={disabled} aria-label={`Reorder ${title}`}>⋮⋮</button>
      <a className="admin-project-link" href={`/admin/editor?table=blog&id=${blog.id}`} aria-label={`View and edit ${title}`}>
        <div className="admin-project-thumb">{blog.cover_url ? <img src={blog.cover_url} alt="" /> : <span>No cover</span>}</div>
        <div className="admin-project-main">
          <h2>{title}</h2>
          <p>{blog.excerpt || "No excerpt yet"}</p>
        </div>
        <span className={`project-status status-${blog.status}`}>{blog.status}</span>
        <div className="admin-project-dates">
          <span>{blog.published_at ? `Published ${formatDate(blog.published_at)}` : "Not published yet"}</span>
        </div>
        <span className="admin-project-edit-cue" aria-hidden="true">View / Edit <span>→</span></span>
      </a>
      {blog.status !== "archived" && <button type="button" className="admin-project-archive" data-archive={blog.id}>Archive</button>}
    </article>
  );
}

export default function BlogAdminList({ embedded = false }) {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [creating, setCreating] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const load = async () => {
    setLoading(true); setError("");
    try { setBlogs(await listAdminBlogs()); }
    catch (err) {
      if (err.message === "ADMIN_AUTH_REQUIRED") {
        const next = embedded ? "/admin/dashboard?section=reading_digest" : "/admin/dashboard";
        window.location.href = `/admin/login?next=${encodeURIComponent(next)}`;
      }
      else setError(err.message || "Could not load blogs.");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => blogs.filter((blog) => {
    if (status !== "all" && blog.status !== status) return false;
    if (!search.trim()) return true;
    const haystack = [blog.title, blog.excerpt, blog.slug, (blog.tags || []).join(" ")].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(search.toLowerCase());
  }), [blogs, search, status]);
  const orderingDisabled = Boolean(search.trim()) || status !== "all";

  const onCreate = async () => {
    setCreating(true); setError("");
    try {
      const id = await createAdminBlog("Untitled post");
      window.location.href = `/admin/editor?table=blog&id=${id}`;
    } catch (err) { setError(err.message || "Could not create post."); setCreating(false); }
  };
  const onDragEnd = async ({ active, over }) => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (!over || active.id === over.id || orderingDisabled) return;
    const oldIndex = blogs.findIndex((item) => item.id === active.id);
    const newIndex = blogs.findIndex((item) => item.id === over.id);
    const next = arrayMove(blogs, oldIndex, newIndex);
    setBlogs(next);
    try {
      const ids = next.map((item) => item.id);
      await reorderAdminBlogs(ids);
      announcePublicOrder(ids);
    }
    catch (err) { setError(err.message || "Ordering failed."); await load(); }
  };
  const onClick = async (event) => {
    const id = event.target.closest("[data-archive]")?.dataset.archive;
    if (!id || !window.confirm("Archive this post? It will be hidden from the public list.")) return;
    try { 
        await archiveAdminBlog(id); 
        setBlogs((items) => items.map((item) => item.id === id ? { ...item, status: "archived" } : item)); 
    } catch (err) { setError(err.message || "Archive failed."); }
  };

  return (
    <div className={`portfolio-admin-page ${embedded ? "is-embedded" : ""}`} onClick={onClick}>
      <header className="portfolio-admin-list-header">
        <div>{!embedded && <a href="/admin/dashboard" className="admin-eyebrow">← Admin home</a>}<h1>Blog Posts</h1><p>Write, format, and publish your blog articles.</p></div>
        <div className="header-actions"><a href="/blog" target="_blank" rel="noreferrer">View public Blog ↗</a><button type="button" className="primary-button" onClick={onCreate} disabled={creating}>{creating ? "Creating…" : "+ Add Post"}</button></div>
      </header>
      <section className="portfolio-admin-toolbar">
        <label><span className="sr-only">Search posts</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, excerpt or tags" /></label>
        <div className="status-tabs" role="group" aria-label="Post status">{["all", "draft", "published", "archived"].map((item) => <button type="button" key={item} className={status === item ? "active" : ""} onClick={() => setStatus(item)}>{item}</button>)}</div>
      </section>
      {orderingDisabled && <p className="admin-hint">Clear search and status filters to reorder the public grid.</p>}
      {error && <div className="admin-notice error">{error}</div>}
      <section className="portfolio-admin-results" aria-live="polite">
        {loading ? <div className="admin-loading">Loading blog posts…</div> : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={filtered.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <div className="portfolio-admin-rows">{filtered.map((blog) => <BlogRow key={blog.id} blog={blog} disabled={orderingDisabled} />)}</div>
            </SortableContext>
          </DndContext>
        )}
        {!loading && !filtered.length && <div className="admin-empty">No posts match this view.</div>}
      </section>
    </div>
  );
}
