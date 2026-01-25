import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function SortableItem(props) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: props.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative',
        zIndex: isDragging ? 999 : 'auto',
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes}>
            {/* We pass listeners to a specific drag handle or the whole item depending on design */}
            {/* In this implementation, we'll pass listeners to the child to decide where to attach */}
            {React.cloneElement(props.children, { dragHandleProps: listeners })}
        </div>
    );
}
