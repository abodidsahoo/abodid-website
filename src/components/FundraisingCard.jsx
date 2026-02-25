import React from 'react';

const FundraisingCard = ({
  title,
  description,
  image,
  href,
  customButtonAction = null
}) => {
  return (
    <div className="fundraising-card">
      <a href={href} className="card-link">
        <div className="image-container">
          <img src={image} alt={title} className="card-image" />
          <div className="overlay"></div>
        </div>
      </a>

      <div className="card-content">
        <a href={href} className="title-link">
          <h3>{title}</h3>
        </a>
        <p className="description">{description}</p>

        {customButtonAction ? (
          <button onClick={customButtonAction} className="btn-back">
            Back this Project
          </button>
        ) : (
          <a href={href} className="btn-back">
            View Project
          </a>
        )}
      </div>

      <style>{`
        .fundraising-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .fundraising-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          border-color: var(--border-strong);
        }

        .image-container {
          position: relative;
          aspect-ratio: 16/9;
          overflow: hidden;
        }

        .card-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.5s ease;
        }

        .fundraising-card:hover .card-image {
          transform: scale(1.05);
        }

        .card-content {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          flex-grow: 1;
        }

        h3 {
          font-family: var(--font-display);
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0 0 0.5rem 0;
          color: var(--text-primary);
          line-height: 1.3;
        }

        .title-link {
          text-decoration: none;
          color: inherit;
        }

        .title-link:hover h3 {
          color: var(--color-brand-red, #a30021);
        }

        .description {
          font-size: 0.95rem;
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 1.5rem;
          flex-grow: 1;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .btn-back {
          display: block;
          width: 100%;
          padding: 0.8rem;
          text-align: center;
          background: transparent;
          border: 1px solid var(--border-strong);
          color: var(--text-primary);
          font-family: var(--font-ui);
          font-weight: 700;
          font-size: 0.9rem;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
        }

        .btn-back:hover {
          background: var(--text-primary);
          color: var(--bg-canvas);
          border-color: var(--text-primary);
        }
      `}</style>
    </div>
  );
};

export default FundraisingCard;
