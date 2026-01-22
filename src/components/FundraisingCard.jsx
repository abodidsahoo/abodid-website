import React, { useState } from 'react';

const FundraisingCard = ({
    title,
    description,
    image,
    goal,
    raised,
    href,
    customButtonAction
}) => {
    const percentage = Math.min((raised / goal) * 100, 100);

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

                <div className="progress-section">
                    <div className="progress-bar-bg">
                        <div
                            className="progress-bar-fill"
                            style={{ width: `${percentage}%` }}
                        ></div>
                    </div>
                    <div className="stats-row">
                        <div className="stat">
                            <span className="value">£{raised.toLocaleString()}</span>
                            <span className="label">Raised</span>
                        </div>
                        <div className="stat right">
                            <span className="value">£{goal.toLocaleString()}</span>
                            <span className="label">Goal</span>
                        </div>
                    </div>
                </div>

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

            <style jsx>{`
        .fundraising-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08); /* border-subtle */
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
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          border-color: rgba(255, 255, 255, 0.2);
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
          font-family: 'Poppins', sans-serif;
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0 0 0.5rem 0;
          color: #fff; /* text-primary */
          line-height: 1.3;
        }

        .title-link {
          text-decoration: none;
          color: inherit;
        }

        .title-link:hover h3 {
          color: #4ade80; /* lab-accent or similar green */
        }

        .description {
          font-size: 0.95rem;
          color: #a3a3a3; /* text-secondary */
          line-height: 1.6;
          margin-bottom: 1.5rem;
          flex-grow: 1;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .progress-section {
          margin-bottom: 1.5rem;
        }

        .progress-bar-bg {
          width: 100%;
          height: 6px;
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 0.75rem;
        }

        .progress-bar-fill {
          height: 100%;
          background: #4ade80; /* Green accent */
          border-radius: 3px;
          transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .stats-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          font-family: 'Space Mono', monospace;
        }

        .stat {
          display: flex;
          flex-direction: column;
        }

        .stat.right {
          align-items: flex-end;
          text-align: right;
        }

        .value {
          color: #fff;
          font-weight: 700;
        }

        .label {
          color: #737373; /* text-tertiary */
          font-size: 0.75rem;
        }

        .btn-back {
          display: block;
          width: 100%;
          padding: 0.8rem;
          text-align: center;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.2);
          color: #fff;
          font-family: 'Space Mono', monospace;
          font-weight: 700;
          font-size: 0.9rem;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
        }

        .btn-back:hover {
          background: #fff;
          color: #000;
          border-color: #fff;
        }
      `}</style>
        </div>
    );
};

export default FundraisingCard;
