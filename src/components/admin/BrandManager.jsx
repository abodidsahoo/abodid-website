import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import AdminPageHeader from './AdminPageHeader';
import ImageUploader from './ImageUploader';

const RELATIONSHIP_OPTIONS = ['Experience', 'Education', 'Volunteering', 'Client', 'Other'];

export default function BrandManager() {
    const [brands, setBrands] = useState([]);
    const [selectedBrandId, setSelectedBrandId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState('');
    const saveStatusTimerRef = useRef(null);
    const saveQueueRef = useRef(Promise.resolve());
    const queuedSaveCountRef = useRef(0);
    const saveFailedRef = useRef(false);

    useEffect(() => {
        fetchBrands();
    }, []);

    useEffect(() => {
        setSelectedBrandId((currentId) => (
            currentId && brands.some((brand) => brand.id === currentId) ? currentId : null
        ));
    }, [brands]);

    useEffect(() => () => {
        if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    }, []);

    const selectedBrand = useMemo(
        () => brands.find((brand) => brand.id === selectedBrandId) || null,
        [brands, selectedBrandId],
    );

    const fetchBrands = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('brands')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) console.error('Error fetching brands:', error);
        else setBrands(data || []);
        setLoading(false);
    };

    const handleUpload = async (uploadedFiles) => {
        const newBrands = [];

        for (const file of uploadedFiles) {
            const rawName = file.name.replace(/\.[^/.]+$/, '');
            const formattedName = rawName
                .replace(/[-_]/g, ' ')
                .replace(/\b\w/g, (letter) => letter.toUpperCase());

            const { data, error } = await supabase
                .from('brands')
                .insert([{
                    name: formattedName,
                    logo_url: file.url,
                    role: '',
                    context: '',
                    category: 'Experience',
                }])
                .select()
                .single();

            if (data) newBrands.push(data);
            if (error) console.error('Error creating brand:', error);
        }

        if (newBrands.length > 0) {
            setBrands((currentBrands) => [...newBrands, ...currentBrands]);
            setSelectedBrandId(newBrands[0].id);
        }
    };

    const showSaveStatus = (message) => {
        if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
        setSaveStatus(message);
        saveStatusTimerRef.current = setTimeout(() => setSaveStatus(''), 2600);
    };

    const finishQueuedSave = async (didFail) => {
        if (didFail) saveFailedRef.current = true;
        queuedSaveCountRef.current = Math.max(0, queuedSaveCountRef.current - 1);

        if (queuedSaveCountRef.current > 0) return;

        if (saveFailedRef.current) {
            saveFailedRef.current = false;
            await fetchBrands();
            showSaveStatus('Couldn’t save');
            return;
        }

        showSaveStatus('Changes saved');
    };

    const updateBrand = (id, field, value) => {
        setBrands((currentBrands) => currentBrands.map((brand) => (
            brand.id === id ? { ...brand, [field]: value } : brand
        )));

        if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
        setSaveStatus('');
        queuedSaveCountRef.current += 1;

        const saveRequest = saveQueueRef.current.then(async () => {
            const { error } = await supabase
                .from('brands')
                .update({ [field]: value })
                .eq('id', id);

            if (error) throw error;
        });

        saveQueueRef.current = saveRequest.catch(() => undefined);
        saveRequest
            .then(() => finishQueuedSave(false))
            .catch((error) => {
                console.error('Error updating brand:', error);
                finishQueuedSave(true);
            });
    };

    const deleteBrand = async (id, logoUrl) => {
        if (!confirm('Are you sure you want to delete this brand?')) return;

        const { error: dbError } = await supabase
            .from('brands')
            .delete()
            .eq('id', id);

        if (dbError) {
            alert('Error deleting brand');
            return;
        }

        try {
            const urlObj = new URL(logoUrl);
            const pathParts = urlObj.pathname.split('/portfolio-assets/');
            if (pathParts.length > 1) {
                await supabase.storage.from('portfolio-assets').remove([pathParts[1]]);
            }
        } catch (error) {
            console.warn('Could not parse storage path for deletion', error);
        }

        setBrands((currentBrands) => currentBrands.filter((brand) => brand.id !== id));
    };

    return (
        <section className="brand-manager" aria-labelledby="brands-title">
            <div className="brand-manager-header">
                <AdminPageHeader
                    className="brand-page-header"
                    headingId="brands-title"
                    title="Brands"
                    description="People who trusted me before anyone else did."
                />
                <div className="brand-header-actions">
                    <span
                        className={`brand-save-status ${saveStatus ? 'is-visible' : ''}`}
                        data-state={saveStatus === 'Changes saved' ? 'saved' : saveStatus ? 'error' : 'idle'}
                        role="status"
                        aria-live="polite"
                    >
                        {saveStatus}
                    </span>
                    <ImageUploader
                        bucket="portfolio-assets"
                        path="brands"
                        multiple
                        onUpload={handleUpload}
                        buttonOnly
                        className="brand-upload-button"
                        label={<><Plus size={15} aria-hidden="true" /> Add New Brand</>}
                    />
                </div>
            </div>

            <div className="brand-workspace">
                <div className="brand-library">
                    {loading ? (
                        <div className="brand-state" role="status">Loading brand logos…</div>
                    ) : brands.length === 0 ? (
                        <div className="brand-state">
                            <strong>No brand logos yet.</strong>
                            <span>Add a logo to start the showcase.</span>
                        </div>
                    ) : (
                        <div className="brand-grid" aria-label="Brand logo library">
                            {brands.map((brand) => {
                                const isSelected = brand.id === selectedBrandId;

                                return (
                                    <button
                                        key={brand.id}
                                        type="button"
                                        className={`brand-tile ${isSelected ? 'is-selected' : ''}`}
                                        aria-pressed={isSelected}
                                        aria-label={`Edit ${brand.name || 'this brand'}`}
                                        onClick={() => setSelectedBrandId(brand.id)}
                                    >
                                        <span className="brand-logo-pane">
                                            <img src={brand.logo_url} alt="" loading="lazy" />
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <aside className="brand-inspector" aria-label="Selected brand editor">
                    {selectedBrand ? (
                        <>
                            <div className="brand-inspector-logo">
                                <img
                                    src={selectedBrand.logo_url}
                                    alt={`${selectedBrand.name || 'Selected brand'} logo`}
                                />
                            </div>

                            <div className="brand-inspector-fields">
                                <label className="brand-field brand-name-field">
                                    <span>Name</span>
                                    <input
                                        type="text"
                                        value={selectedBrand.name || ''}
                                        onChange={(event) => updateBrand(selectedBrand.id, 'name', event.target.value)}
                                        placeholder="Brand name"
                                    />
                                </label>

                                <label className="brand-field">
                                    <span>Role</span>
                                    <input
                                        type="text"
                                        value={selectedBrand.role || ''}
                                        onChange={(event) => updateBrand(selectedBrand.id, 'role', event.target.value)}
                                        placeholder="What was your role?"
                                    />
                                </label>

                                <fieldset className="brand-relationship-field">
                                    <legend>Relationship</legend>
                                    <div className="brand-relationship-options">
                                        {RELATIONSHIP_OPTIONS.map((relationship) => {
                                            const currentRelationship = selectedBrand.category || 'Experience';
                                            const isActive = currentRelationship.toLowerCase() === relationship.toLowerCase();

                                            return (
                                                <button
                                                    key={relationship}
                                                    type="button"
                                                    className={isActive ? 'is-active' : ''}
                                                    aria-pressed={isActive}
                                                    onClick={() => updateBrand(selectedBrand.id, 'category', relationship)}
                                                >
                                                    {relationship}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </fieldset>

                                <label className="brand-field">
                                    <span>Context</span>
                                    <textarea
                                        value={selectedBrand.context || ''}
                                        onChange={(event) => updateBrand(selectedBrand.id, 'context', event.target.value)}
                                        placeholder="Add a little context about the work."
                                        rows={4}
                                    />
                                </label>
                            </div>

                            <button
                                type="button"
                                className="brand-delete-button"
                                onClick={() => deleteBrand(selectedBrand.id, selectedBrand.logo_url)}
                            >
                                <Trash2 size={15} aria-hidden="true" /> Delete brand
                            </button>
                        </>
                    ) : (
                        <div className="brand-inspector-empty">
                            <strong>Select a logo</strong>
                            <span>Its details will appear here.</span>
                        </div>
                    )}
                </aside>
            </div>

            <style>{`
                .brand-manager {
                    --brand-ink: var(--text-primary);
                    --brand-muted: var(--text-secondary);
                    --brand-line: var(--border-subtle);
                    width: 100%;
                    max-width: var(--admin-page-content-max);
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    color: var(--text-primary);
                }
                .brand-manager *, .brand-manager *::before, .brand-manager *::after {
                    box-sizing: border-box;
                }
                .brand-manager-header {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    gap: 2rem;
                    padding: var(--admin-page-heading-offset-block) var(--admin-page-heading-offset-inline) 1.5rem;
                    border-bottom: 1px solid var(--border-subtle);
                }
                .brand-page-header {
                    min-width: 0;
                    flex: 1 1 34rem;
                }
                .brand-header-actions {
                    display: flex;
                    align-items: center;
                    flex: 0 0 auto;
                    gap: 0.75rem;
                    padding-bottom: 0.25rem;
                }
                .brand-save-status {
                    min-width: 6.8rem;
                    color: var(--brand-muted);
                    font-size: 0.68rem;
                    font-weight: 600;
                    text-align: right;
                    opacity: 0;
                    transform: translateY(2px);
                    transition: opacity 160ms ease, transform 160ms ease;
                }
                .brand-save-status.is-visible {
                    opacity: 1;
                    transform: translateY(0);
                }
                .brand-save-status[data-state="error"] {
                    color: #a13f3f;
                }
                .brand-upload-button {
                    min-height: 38px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.42rem;
                    padding: 0.55rem 0.78rem;
                    border: 1px solid var(--text-primary);
                    border-radius: 0;
                    background: var(--text-primary);
                    color: var(--bg-color);
                    cursor: pointer;
                    font-size: 0.7rem;
                    font-weight: 700;
                    white-space: nowrap;
                }
                .brand-upload-button.uploading {
                    cursor: wait;
                    opacity: 0.58;
                }
                .brand-workspace {
                    min-width: 0;
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) minmax(320px, 370px);
                    align-items: start;
                    margin: 0 var(--admin-page-heading-offset-inline) 3rem;
                    border: 1px solid var(--brand-line);
                    background: transparent;
                }
                .brand-library {
                    min-width: 0;
                    min-height: 390px;
                    background: transparent;
                }
                .brand-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(176px, 1fr));
                    align-items: stretch;
                    gap: 0;
                    padding: 0;
                    background: transparent;
                }
                .brand-tile {
                    position: relative;
                    min-width: 0;
                    aspect-ratio: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 1rem;
                    border: 0;
                    border-right: 1px solid var(--brand-line);
                    border-bottom: 1px solid var(--brand-line);
                    border-radius: 0;
                    background: transparent;
                    color: var(--brand-ink);
                    cursor: pointer;
                    text-align: left;
                }
                .brand-tile:focus-visible {
                    z-index: 2;
                    outline: 1px solid var(--brand-ink);
                    outline-offset: -1px;
                }
                .brand-tile.is-selected {
                    z-index: 1;
                    background: transparent;
                    box-shadow: inset 0 0 0 1px var(--brand-ink);
                }
                .brand-logo-pane {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    background: transparent;
                }
                .brand-logo-pane img {
                    width: 100%;
                    height: 100%;
                    display: block;
                    object-fit: contain;
                    object-position: center;
                    transform: scale(1);
                    transition: transform 180ms cubic-bezier(0.2, 0.75, 0.25, 1);
                }
                .brand-tile:hover .brand-logo-pane img,
                .brand-tile:focus-visible .brand-logo-pane img {
                    transform: scale(1.045);
                }
                .brand-inspector {
                    min-width: 0;
                    min-height: 560px;
                    position: sticky;
                    top: 1rem;
                    display: flex;
                    flex-direction: column;
                    padding: 1.3rem;
                    border-left: 1px solid var(--brand-line);
                    background: transparent;
                    color: var(--brand-ink);
                }
                .brand-field > span,
                .brand-relationship-field legend {
                    display: block;
                    color: var(--brand-muted);
                    font-size: 0.62rem;
                    font-weight: 700;
                    letter-spacing: 0.09em;
                    text-transform: uppercase;
                }
                .brand-inspector-logo {
                    width: 100%;
                    aspect-ratio: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: clamp(1rem, 7%, 1.75rem);
                    border-bottom: 1px solid var(--brand-line);
                    background: transparent;
                }
                .brand-inspector-logo img {
                    width: 100%;
                    height: 100%;
                    display: block;
                    object-fit: contain;
                    object-position: center;
                }
                .brand-inspector-fields {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    padding: 1.15rem 0;
                }
                .brand-field {
                    display: flex;
                    flex-direction: column;
                    gap: 0.42rem;
                }
                .brand-field input,
                .brand-field textarea {
                    width: 100%;
                    border: 1px solid var(--brand-line);
                    border-radius: 0;
                    outline: 0;
                    background: transparent;
                    color: var(--brand-ink);
                    font: inherit;
                    font-size: 0.84rem;
                    line-height: 1.45;
                }
                .brand-field input {
                    min-height: 43px;
                    padding: 0.68rem 0.75rem;
                }
                .brand-name-field input {
                    font-size: 1rem;
                    font-weight: 650;
                }
                .brand-field textarea {
                    min-height: 94px;
                    padding: 0.72rem 0.75rem;
                    resize: vertical;
                }
                .brand-field input:focus,
                .brand-field textarea:focus {
                    border-color: var(--brand-ink);
                    box-shadow: inset 0 0 0 1px var(--brand-ink);
                }
                .brand-field input::placeholder,
                .brand-field textarea::placeholder {
                    color: #92928b;
                }
                .brand-relationship-field {
                    min-width: 0;
                    margin: 0;
                    padding: 0;
                    border: 0;
                }
                .brand-relationship-field legend {
                    margin-bottom: 0.62rem;
                }
                .brand-relationship-options {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.4rem;
                }
                .brand-relationship-options button {
                    min-height: 32px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0.42rem 0.72rem;
                    border: 1px solid var(--brand-line);
                    border-radius: 999px;
                    background: transparent;
                    color: var(--brand-muted);
                    cursor: pointer;
                    font: inherit;
                    font-size: 0.68rem;
                    font-weight: 600;
                    line-height: 1;
                    transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
                }
                .brand-relationship-options button:hover {
                    border-color: color-mix(in srgb, var(--brand-ink) 55%, transparent);
                    background: color-mix(in srgb, var(--brand-ink) 5%, transparent);
                    color: var(--brand-ink);
                }
                .brand-relationship-options button.is-active {
                    border-color: var(--brand-ink);
                    background: var(--brand-ink);
                    color: var(--bg-color);
                }
                .brand-relationship-options button:focus-visible {
                    outline: 2px solid color-mix(in srgb, var(--brand-ink) 40%, transparent);
                    outline-offset: 2px;
                }
                .brand-delete-button {
                    width: fit-content;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.42rem;
                    margin-top: auto;
                    padding: 0.55rem 0;
                    border: 0;
                    border-bottom: 1px solid transparent;
                    border-radius: 0;
                    background: transparent;
                    color: #a13f3f;
                    cursor: pointer;
                    font: inherit;
                    font-size: 0.7rem;
                    font-weight: 650;
                }
                .brand-delete-button:hover,
                .brand-delete-button:focus-visible {
                    border-bottom-color: currentColor;
                    outline: 0;
                }
                .brand-state,
                .brand-inspector-empty {
                    min-height: 390px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 0.35rem;
                    color: var(--brand-muted);
                    font-size: 0.75rem;
                    text-align: center;
                }
                .brand-state strong,
                .brand-inspector-empty strong {
                    color: var(--brand-ink);
                    font-size: 0.92rem;
                }
                @media (max-width: 1080px) {
                    .brand-manager-header {
                        align-items: flex-start;
                        flex-direction: column;
                    }
                    .brand-page-header {
                        width: 100%;
                        flex-basis: auto;
                    }
                    .brand-header-actions {
                        width: 100%;
                        justify-content: space-between;
                    }
                    .brand-workspace {
                        grid-template-columns: minmax(0, 1fr);
                    }
                    .brand-inspector {
                        min-height: 0;
                        position: static;
                        border-top: 1px solid var(--brand-line);
                        border-left: 0;
                    }
                }
                @media (max-width: 620px) {
                    .brand-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }
                    .brand-tile {
                        padding: 0.75rem;
                    }
                    .brand-inspector {
                        padding: 1rem;
                    }
                }
                @media (prefers-reduced-motion: reduce) {
                    .brand-logo-pane img {
                        transition: none;
                    }
                }
            `}</style>
        </section>
    );
}
