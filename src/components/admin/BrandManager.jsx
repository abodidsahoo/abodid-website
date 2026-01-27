import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import ImageUploader from './ImageUploader';

export default function BrandManager() {
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchBrands();
    }, []);

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
        // Process uploads and create brand entries
        const newBrands = [];

        for (const file of uploadedFiles) {
            // Extract name from filename (remove extension, replace separators with spaces)
            const rawName = file.name.replace(/\.[^/.]+$/, "");
            const formattedName = rawName
                .replace(/[-_]/g, " ")
                .replace(/\b\w/g, l => l.toUpperCase()); // Title Case

            const { data, error } = await supabase
                .from('brands')
                .insert([{
                    name: formattedName,
                    logo_url: file.url,
                    role: '',
                    category: 'Experience' // Default category
                }])
                .select()
                .single();

            if (data) newBrands.push(data);
            if (error) console.error('Error creating brand:', error);
        }

        setBrands(prev => [...newBrands, ...prev]);
    };

    const updateBrand = async (id, field, value) => {
        setSaving(true);

        // Optimistic update
        setBrands(prev => prev.map(b =>
            b.id === id ? { ...b, [field]: value } : b
        ));

        const { error } = await supabase
            .from('brands')
            .update({ [field]: value })
            .eq('id', id);

        if (error) {
            console.error('Error updating brand:', error);
            // Revert on error (could be handled better but simple for now)
            fetchBrands();
        }
        setSaving(false);
    };

    const deleteBrand = async (id, logoUrl) => {
        if (!confirm('Are you sure you want to delete this brand?')) return;

        // Delete from DB
        const { error: dbError } = await supabase
            .from('brands')
            .delete()
            .eq('id', id);

        if (dbError) {
            alert('Error deleting brand');
            return;
        }

        // Delete from Storage (optional but good cleanup)
        // Extract path from URL: .../portfolio-assets/brands/filename.jpg
        try {
            const urlObj = new URL(logoUrl);
            const pathParts = urlObj.pathname.split('/portfolio-assets/');
            if (pathParts.length > 1) {
                const storagePath = pathParts[1];
                await supabase.storage.from('portfolio-assets').remove([storagePath]);
            }
        } catch (e) {
            console.warn('Could not parse storage path for deletion', e);
        }

        setBrands(prev => prev.filter(b => b.id !== id));
    };

    return (
        <div className="brand-manager">
            <div className="uploader-section">
                <h3>Upload Logos</h3>
                <p className="hint">Drag & drop logos here. Names will be auto-generated from filenames.</p>
                <ImageUploader
                    bucket="portfolio-assets"
                    path="brands"
                    multiple={true}
                    onUpload={handleUpload}
                    label="Drop Brands Here"
                />
            </div>

            <div className="brands-list">
                <h3>Manage Brands ({brands.length}) {saving && <span className="saving-indicator">Saving...</span>}</h3>

                {loading ? <p>Loading...</p> : (
                    <div className="grid">
                        {brands.map(brand => (
                            <div key={brand.id} className="brand-card">
                                <div className="img-container">
                                    <img src={brand.logo_url} alt={brand.name} />
                                    <button
                                        className="delete-btn"
                                        onClick={() => deleteBrand(brand.id, brand.logo_url)}
                                        title="Delete"
                                    >
                                        ×
                                    </button>
                                </div>
                                <div className="fields">
                                    <input
                                        type="text"
                                        value={brand.name}
                                        onChange={(e) => updateBrand(brand.id, 'name', e.target.value)}
                                        placeholder="Brand Name"
                                        className="input-name"
                                    />
                                    <input
                                        type="text"
                                        value={brand.role || ''}
                                        onChange={(e) => updateBrand(brand.id, 'role', e.target.value)}
                                        placeholder="My Role (e.g. Designer)"
                                        className="input-role"
                                    />
                                    <select
                                        value={brand.category || 'Experience'}
                                        onChange={(e) => updateBrand(brand.id, 'category', e.target.value)}
                                        className="input-category"
                                    >
                                        <option value="Experience">Experience</option>
                                        <option value="Education">Education</option>
                                        <option value="Volunteering">Volunteering</option>
                                        <option value="Client">Client</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                .brand-manager {
                    display: flex;
                    flex-direction: column;
                    gap: 3rem;
                }
                .hint {
                    color: var(--text-secondary);
                    margin-bottom: 1rem;
                    font-size: 0.9rem;
                }
                .saving-indicator {
                    font-size: 0.8rem;
                    color: var(--accent-color, #0f0);
                    margin-left: 1rem;
                    animation: pulse 1s infinite;
                }
                .grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 1.5rem;
                }
                .brand-card {
                    background: var(--bg-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: 8px;
                    overflow: hidden;
                    transition: all 0.2s;
                    display: flex;
                    flex-direction: column;
                }
                .brand-card:hover {
                    border-color: var(--border-strong);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }
                .img-container {
                    height: 120px;
                    width: 100%;
                    background: #fff; /* Logos often need light bg */
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 1rem;
                    position: relative;
                }
                .img-container img {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                }
                .delete-btn {
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: rgba(0,0,0,0.5);
                    color: white;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                .brand-card:hover .delete-btn {
                    opacity: 1;
                }
                .delete-btn:hover {
                    background: red;
                }
                .fields {
                    padding: 1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                input, select {
                    width: 100%;
                    background: var(--bg-input, rgba(255,255,255,0.05));
                    border: 1px solid var(--border-subtle);
                    padding: 0.5rem;
                    border-radius: 4px;
                    color: var(--text-primary);
                    font-size: 0.9rem;
                }
                input:focus, select:focus {
                    outline: none;
                    border-color: var(--text-secondary);
                }
                .input-name {
                    font-weight: bold;
                }
                @keyframes pulse {
                    0% { opacity: 0.5; }
                    50% { opacity: 1; }
                    100% { opacity: 0.5; }
                }
            `}</style>
        </div>
    );
}
