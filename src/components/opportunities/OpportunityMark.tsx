import React from 'react';

/** Geometry keeps the radar dot centered independently of font metrics. */
export function OpportunityMark() {
  return (
    <svg className="opp-product-mark" viewBox="0 0 32 32" width="32" height="32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#ffe457" />
      <circle cx="16" cy="16" r="9" stroke="#171717" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="5" fill="#171717" />
    </svg>
  );
}
