import React from 'react';
import { Pencil } from 'lucide-react';

export default function AdminEditButton({ resourceId, isAdmin }: { resourceId: string; isAdmin: boolean }) {
    if (!isAdmin) return null;

    return (
        <a
            href={`/resources/${resourceId}/edit`}
            className="detail-back-btn detail-edit-btn"
        >
            <Pencil size={16} strokeWidth={2} aria-hidden="true" />
            <span>Edit Resource</span>
        </a>
    );
}
