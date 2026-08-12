import React from 'react';

/**
 * Shared admin-page hierarchy. Eyebrows and title icons are intentionally not
 * part of this component so every section follows the overview's visual voice.
 */
export default function AdminPageHeader({
    title,
    description,
    headingId,
    className = '',
    as: Heading = 'h2',
}) {
    const classes = ['admin-page-header', className].filter(Boolean).join(' ');

    return (
        <header className={classes}>
            <Heading id={headingId} className="admin-page-header__title">{title}</Heading>
            {description && (
                <p className="admin-page-header__description">{description}</p>
            )}
        </header>
    );
}
