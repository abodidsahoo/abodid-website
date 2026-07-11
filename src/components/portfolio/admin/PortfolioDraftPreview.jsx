import React, { useEffect, useState } from "react";
import PortfolioProjectRenderer from "../PortfolioProjectRenderer";

export default function PortfolioDraftPreview({ projectId }) {
  const [project, setProject] = useState(null);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(`portfolio:preview:${projectId}`);
      if (stored) setProject(JSON.parse(stored));
    } catch {
      setProject(null);
    }
  }, [projectId]);

  if (!project) {
    return <div className="portfolio-draft-preview-empty">Preview data is unavailable. Close this preview and open it again from the editor.</div>;
  }

  return <PortfolioProjectRenderer project={project} preview />;
}

