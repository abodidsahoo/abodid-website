import React, { useState } from "react";
import { createPortfolioProject } from "../../../lib/portfolio/services";
import "../../../styles/portfolio-admin.css";

export default function PortfolioNewProject() {
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault(); setCreating(true); setError("");
    try {
      const id = await createPortfolioProject(title || "Untitled project");
      window.location.href = `/admin/projects/${id}`;
    } catch (err) {
      if (err.message === "ADMIN_AUTH_REQUIRED") window.location.href = "/admin/login?next=/admin/projects/new";
      else { setError(err.message || "Could not create project."); setCreating(false); }
    }
  };
  return <main className="portfolio-admin-page"><a href="/admin/projects" className="admin-eyebrow">← Portfolio projects</a><form onSubmit={submit} className="editor-spine-card" style={{ marginTop: "3rem" }}><span className="editor-eyebrow">New project</span><h1>Start a project draft</h1><p style={{ color: "var(--text-secondary)" }}>This creates private draft state only. Nothing appears in Work until you publish.</p><label className="editor-field"><span>Working title</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Untitled project" /></label>{error && <div className="admin-notice error">{error}</div>}<button type="submit" className="primary-button" disabled={creating}>{creating ? "Creating draft…" : "Create draft"}</button></form></main>;
}

