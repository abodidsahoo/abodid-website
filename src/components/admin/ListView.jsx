import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableItem } from './SortableItem';

export default function ListView({ table, title, onCreate }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);
    const [isSavingOrder, setIsSavingOrder] = useState(false);

    // Define which tables support reordering
    const supportReorder = ['photography', 'films', 'education', 'research', 'blog'].includes(table);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        fetchItems();
    }, [table]);

    const fetchItems = async () => {
        try {
            setLoading(true);
            let query = supabase.from(table).select('*');

            if (table === 'blog') {
                query = query.order('sort_order', { ascending: true }).order('published_at', { ascending: false });
            } else if (table === 'page_metadata') {
                query = query.order('page_path', { ascending: true });
            } else if (table === 'hub_resources') {
                query = query.order('created_at', { ascending: false });
            } else if (supportReorder) {
                query = query.order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
            } else {
                query = query.order('created_at', { ascending: false });
            }

            const { data, error } = await query;

            if (error) throw error;
            setItems(data || []);
        } catch (err) {
            console.error('Error fetching items:', err);
            setErrorMsg(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDragEnd = async (event) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            setItems((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                const newItems = arrayMove(items, oldIndex, newIndex);

                saveOrder(newItems);
                return newItems;
            });
        }
    };

    const saveOrder = async (newItems) => {
        setIsSavingOrder(true);
        try {
            const updates = newItems.map((item, index) => ({
                id: item.id,
                sort_order: index,
            }));

            const promises = updates.map(update =>
                supabase.from(table).update({ sort_order: update.sort_order }).eq('id', update.id)
            );

            await Promise.all(promises);
            console.log('Order saved');

        } catch (err) {
            console.error('Failed to save order:', err);
            alert('Failed to save new order. Please refresh.');
        } finally {
            setIsSavingOrder(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;

        if (table === 'hub_resources') {
            const { deleteResource } = await import('../../lib/resources/db');
            const result = await deleteResource(id);
            if (result.success) {
                fetchItems();
            } else {
                alert('Error deleting resource: ' + result.error);
            }
        } else {
            const { error } = await supabase.from(table).delete().eq('id', id);
            if (!error) fetchItems();
            else alert('Error deleting: ' + error.message);
        }
    };

    const handleToggleStatus = async (item) => {
        const id = item.id;
        const isMetadata = table === 'page_metadata';
        const field = isMetadata ? 'is_active' : 'published';
        const currentValue = isMetadata ? item.is_active : item.published;
        const newValue = !currentValue;

        setItems(items.map(i => i.id === id ? { ...i, [field]: newValue } : i));

        const { error } = await supabase
            .from(table)
            .update({ [field]: newValue })
            .eq('id', id);

        if (error) {
            alert('Error updating status: ' + error.message);
            fetchItems();
        }
    };

    const getItemStatus = (item) => {
        if (table === 'page_metadata') {
            return {
                isLive: item.is_active,
                text: item.is_active ? 'Live' : 'Hidden'
            };
        }
        if (table === 'hub_resources') {
            return { isLive: true, text: 'Resource' };
        }
        return {
            isLive: item.published,
            text: item.published ? 'Live' : 'Draft'
        };
    };

    const getItemTitle = (item) => {
        if (table === 'page_metadata') return item.page_title || item.page_path;
        return item.title || '(No Title)';
    };

    const handleCreate = () => {
        if (onCreate) {
            onCreate();
        } else {
            window.location.href = `/admin/editor?table=${table === 'metadata' ? 'page_metadata' : table}&id=new`;
        }
    };

    if (loading) return <div className="loading-state">Loading {table}...</div>;
    if (errorMsg) return <div style={{ color: '#ef4444' }}>Error: {errorMsg}</div>;

    return (
        <div className="list-wrapper">
            <header className="content-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h2 className="section-title">{title}</h2>
                    {isSavingOrder && <span style={{ fontSize: '0.8rem', color: '#10B981' }}>Saving order...</span>}
                    {supportReorder && !isSavingOrder && items.length > 1 && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Drag to reorder</span>
                    )}
                </div>
                <button
                    onClick={handleCreate}
                    className="btn-create-primary"
                >
                    + Create New
                </button>
            </header>

            <div className="list-container">
                {items.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)' }}>No items found.</p>
                ) : (
                    supportReorder ? (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={items.map(i => i.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {items.map(item => {
                                    const status = getItemStatus(item);
                                    const canToggle = table !== 'hub_resources';

                                    return (
                                        <SortableItem key={item.id} id={item.id}>
                                            {(listeners) => (
                                                <div className="list-row-card sortable-row">
                                                    <div
                                                        className="drag-handle"
                                                        {...listeners}
                                                        style={{ cursor: 'grab' }}
                                                    >
                                                        ⋮⣿
                                                    </div>
                                                    <div className="row-main-info">
                                                        <span className="row-title">{getItemTitle(item)}</span>
                                                    </div>

                                                    <div className="row-actions">
                                                        {canToggle && (
                                                            <button
                                                                className={`btn-action-box ${status.isLive ? 'toggle-live' : 'toggle-draft'}`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleToggleStatus(item);
                                                                }}
                                                                title="Toggle Status"
                                                            >
                                                                <span className={`status-dot-inner`} style={{ background: status.isLive ? '#10B981' : 'currentColor' }}></span>
                                                                {status.text}
                                                            </button>
                                                        )}

                                                        <a href={`/admin/editor?table=${table}&id=${item.id}`} className="btn-action-box">
                                                            Edit
                                                        </a>
                                                        <button onClick={() => handleDelete(item.id)} className="btn-action-box delete">
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </SortableItem>
                                    );
                                })}
                            </SortableContext>
                        </DndContext>
                    ) : (
                        items.map(item => {
                            const status = getItemStatus(item);
                            const canToggle = table !== 'hub_resources';
                            return (
                                <div key={item.id} className="list-row-card">
                                    <div className="row-main-info">
                                        <span className="row-title">{getItemTitle(item)}</span>
                                    </div>

                                    <div className="row-actions">
                                        {canToggle && (
                                            <button
                                                className={`btn-action-box ${status.isLive ? 'toggle-live' : 'toggle-draft'}`}
                                                onClick={() => handleToggleStatus(item)}
                                                title="Toggle Status"
                                            >
                                                <span className={`status-dot-inner`} style={{ background: status.isLive ? '#10B981' : 'currentColor' }}></span>
                                                {status.text}
                                            </button>
                                        )}

                                        <a href={`/admin/editor?table=${table}&id=${item.id}`} className="btn-action-box">
                                            Edit
                                        </a>
                                        <button onClick={() => handleDelete(item.id)} className="btn-action-box delete">
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )
                )}
            </div>
            <style>{`
                .drag-handle {
                    padding: 0.5rem;
                    margin-right: 0.5rem;
                    color: var(--text-tertiary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2rem;
                    touch-action: none; 
                }
                .drag-handle:hover {
                    color: var(--text-primary);
                }
                .sortable-row {
                    margin-bottom: 1rem;
                    background: var(--bg-surface);
                    border: 1px solid var(--border-subtle);
                    z-index: 10; 
                }
            `}</style>
        </div>
    );
}
