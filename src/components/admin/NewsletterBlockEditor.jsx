import { useEffect, useRef, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    cloneNewsletterBlock,
    createNewsletterColumnItem,
    getNewsletterColumnItems,
    NEWSLETTER_BLOCK_TYPES,
    NEWSLETTER_COLUMN_ITEM_TYPES,
    NEWSLETTER_FONT_OPTIONS,
    resizeNewsletterColumns,
} from '../../lib/newsletter/blocks.js';
import ImageUploader from './ImageUploader';
import InlineLinkEditor from './InlineLinkEditor';
import NewsletterMediaPicker from './NewsletterMediaPicker';

const FONT_WEIGHTS = [400, 500, 600, 700, 800];
const ALIGNMENTS = ['left', 'center', 'right'];

function ColorControl({ label, value, onChange }) {
    const pickerValue = /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000';
    return (
        <div className="newsletter-control color-control" role="group" aria-label={label}>
            <span>{label}</span>
            <span className="color-control-inputs">
                <input
                    type="color"
                    value={pickerValue}
                    onChange={(event) => onChange(event.target.value)}
                    aria-label={`${label} colour picker`}
                />
                <input
                    type="text"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    className="mini-input color-value"
                    aria-label={`${label} hex value`}
                />
            </span>
        </div>
    );
}

function NumberControl({ label, value, onChange, min, max, step = 1, suffix = '' }) {
    return (
        <label className="newsletter-control">
            <span>{label}</span>
            <span className="number-control-input">
                <input
                    type="number"
                    value={value}
                    min={min}
                    max={max}
                    step={step}
                    onChange={(event) => onChange(Number(event.target.value))}
                    className="mini-input"
                />
                {suffix && <small>{suffix}</small>}
            </span>
        </label>
    );
}

function SelectControl({ label, value, onChange, options }) {
    return (
        <label className="newsletter-control">
            <span>{label}</span>
            <select value={value} onChange={(event) => onChange(event.target.value)} className="mini-input">
                {options.map((option) => {
                    const optionValue = typeof option === 'object' ? option.value : option;
                    const optionLabel = typeof option === 'object' ? option.label : option;
                    return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
                })}
            </select>
        </label>
    );
}

function SegmentControl({ label, value, onChange, options }) {
    return (
        <div className="newsletter-control">
            <span>{label}</span>
            <div className="editor-segment" role="group" aria-label={label}>
                {options.map((option) => (
                    <button
                        key={String(option.value)}
                        type="button"
                        className={value === option.value ? 'active' : ''}
                        onClick={() => onChange(option.value)}
                        aria-pressed={value === option.value}
                        aria-label={option.ariaLabel || option.label}
                        title={option.ariaLabel || option.label}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

function PersonalizedTextarea({ label, value, onChange, rows = 4, placeholder = '' }) {
    const textareaRef = useRef(null);

    const insertName = () => {
        const textarea = textareaRef.current;
        const token = '{{first_name}}';
        const start = textarea?.selectionStart ?? String(value || '').length;
        const end = textarea?.selectionEnd ?? start;
        const nextValue = `${String(value || '').slice(0, start)}${token}${String(value || '').slice(end)}`;
        onChange(nextValue);
        requestAnimationFrame(() => {
            textarea?.focus();
            textarea?.setSelectionRange(start + token.length, start + token.length);
        });
    };

    return (
        <label className="field-group compact-field personalized-text-field">
            <span className="personalized-field-heading">
                <span>{label}</span>
                <button type="button" onClick={insertName}>+ Insert name</button>
            </span>
            <textarea
                ref={textareaRef}
                className="box-input"
                rows={rows}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
            />
        </label>
    );
}

function TypographyControls({ block, updateBlock, prefix = '', showLineHeight = false, lineHeightMax = 2.4 }) {
    const field = (name) => `${prefix}${name[0].toUpperCase()}${name.slice(1)}`;
    const fontField = prefix ? field('font') : 'font';
    const fontSizeField = prefix ? field('fontSize') : 'fontSize';
    const fontWeightField = prefix ? field('fontWeight') : 'fontWeight';
    const colorField = prefix === 'heading'
        ? 'headingColor'
        : prefix === 'subheading'
            ? 'subheadingColor'
        : prefix === 'title'
            ? 'titleColor'
            : prefix === 'text'
                ? 'textColor'
                : 'color';
    const defaultColor = '#ffffff';

    return (
        <div className="control-grid typography-controls">
            <SelectControl
                label="Font"
                value={block[fontField] || 'satoshi'}
                onChange={(value) => updateBlock({ [fontField]: value })}
                options={NEWSLETTER_FONT_OPTIONS}
            />
            <NumberControl
                label="Size"
                value={block[fontSizeField]}
                onChange={(value) => updateBlock({ [fontSizeField]: value })}
                min={10}
                max={72}
                suffix="px"
            />
            <SelectControl
                label="Weight"
                value={block[fontWeightField]}
                onChange={(value) => updateBlock({ [fontWeightField]: Number(value) })}
                options={FONT_WEIGHTS.map((weight) => ({ value: weight, label: String(weight) }))}
            />
            <ColorControl
                label="Colour"
                value={block[colorField] || defaultColor}
                onChange={(value) => updateBlock({ [colorField]: value })}
            />
            {!prefix && (
                <SegmentControl
                    label="Align"
                    value={block.align || 'left'}
                    onChange={(value) => updateBlock({ align: value })}
                    options={[
                        { value: 'left', label: '←', ariaLabel: 'Align left' },
                        { value: 'center', label: '↔', ariaLabel: 'Align centre' },
                        { value: 'right', label: '→', ariaLabel: 'Align right' },
                    ]}
                />
            )}
            {showLineHeight && !prefix && (
                <NumberControl
                    label="Line height"
                    value={block.lineHeight}
                    min={1}
                    max={lineHeightMax}
                    step={0.05}
                    onChange={(value) => updateBlock({ lineHeight: value })}
                />
            )}
        </div>
    );
}

function SectionControls({ block, settings, updateBlock }) {
    const usesCustomBackground = Boolean(block.backgroundColor);

    return (
        <div className="section-style-controls">
            <div className="section-style-heading">
                <label className="inherit-background-toggle">
                    <input
                        type="checkbox"
                        checked={usesCustomBackground}
                        onChange={(event) => updateBlock({
                            backgroundColor: event.target.checked ? settings.canvasBackgroundColor : null,
                        })}
                    />
                    Custom background
                </label>
                <span>Padding controls the empty space inside this block.</span>
            </div>
            <div className="section-style-toolbar">
                {usesCustomBackground && (
                    <ColorControl
                        label="Block background"
                        value={block.backgroundColor}
                        onChange={(value) => updateBlock({ backgroundColor: value })}
                    />
                )}
                <div className="control-grid spacing-controls">
                    <NumberControl label="Top padding" value={block.paddingTop} min={0} max={96} suffix="px" onChange={(value) => updateBlock({ paddingTop: value })} />
                    <NumberControl label="Bottom padding" value={block.paddingBottom} min={0} max={96} suffix="px" onChange={(value) => updateBlock({ paddingBottom: value })} />
                    <NumberControl label="Left padding" value={block.paddingLeft} min={0} max={72} suffix="px" onChange={(value) => updateBlock({ paddingLeft: value })} />
                    <NumberControl label="Right padding" value={block.paddingRight} min={0} max={72} suffix="px" onChange={(value) => updateBlock({ paddingRight: value })} />
                </div>
            </div>
        </div>
    );
}

function ImageShapeControl({ rounded, onChange }) {
    return (
        <SegmentControl
            label="Image corners"
            value={Boolean(rounded)}
            onChange={onChange}
            options={[
                { value: false, label: 'Sharp' },
                { value: true, label: 'Rounded' },
            ]}
        />
    );
}

function HorizontalEdgeControl({ block, updateBlock }) {
    const bodyInset = 40;
    const leftInset = Number(block.paddingLeft ?? bodyInset);
    const rightInset = Number(block.paddingRight ?? bodyInset);
    const alignsWithBody = leftInset === bodyInset && rightInset === bodyInset;
    const extraInset = Math.max(0, Math.round(((leftInset + rightInset) / 2) - bodyInset));

    const setMode = (mode) => {
        const inset = mode === 'body' ? bodyInset : bodyInset + Math.max(extraInset, 16);
        updateBlock({ paddingLeft: inset, paddingRight: inset });
    };

    return (
        <div className="edge-alignment-controls">
            <SegmentControl
                label="Horizontal edges"
                value={alignsWithBody ? 'body' : 'inset'}
                onChange={setMode}
                options={[
                    { value: 'body', label: 'Align with text' },
                    { value: 'inset', label: 'Extra padding' },
                ]}
            />
            {!alignsWithBody && (
                <NumberControl
                    label="Extra edge padding"
                    value={extraInset}
                    min={4}
                    max={40}
                    step={4}
                    suffix="px"
                    onChange={(value) => updateBlock({ paddingLeft: bodyInset + value, paddingRight: bodyInset + value })}
                />
            )}
        </div>
    );
}

function ExistingImage({ src, alt = '', fixedHeight = null }) {
    if (!src) return null;
    return (
        <img
            className="block-image-reference"
            src={src}
            alt={alt}
            style={fixedHeight ? { height: `${fixedHeight}px`, objectFit: 'cover' } : undefined}
        />
    );
}

function ColumnItemFields({ blockId, columnId, item, updateItem, mediaAccessToken, showCustomization }) {
    const alignmentOptions = ALIGNMENTS.map((alignment) => ({
        value: alignment,
        label: alignment[0].toUpperCase() + alignment.slice(1),
    }));

    if (item.type === 'heading') {
        return (
            <>
                <label className="field-group compact-field"><span>Heading</span><input className="box-input" value={item.text} onChange={(event) => updateItem({ text: event.target.value })} /></label>
                {showCustomization && <div className="control-grid column-item-customization">
                    <SelectControl label="Font" value={item.font || 'satoshi'} onChange={(value) => updateItem({ font: value })} options={NEWSLETTER_FONT_OPTIONS} />
                    <NumberControl label="Font size" value={item.fontSize} min={12} max={42} suffix="px" onChange={(value) => updateItem({ fontSize: value })} />
                    <SelectControl label="Font weight" value={item.fontWeight} onChange={(value) => updateItem({ fontWeight: Number(value) })} options={FONT_WEIGHTS} />
                    <ColorControl label="Text colour" value={item.color} onChange={(value) => updateItem({ color: value })} />
                    <SelectControl label="Alignment" value={item.align} onChange={(value) => updateItem({ align: value })} options={alignmentOptions} />
                </div>}
            </>
        );
    }

    if (item.type === 'text') {
        return (
            <>
                <label className="field-group compact-field"><span>Text</span><textarea className="box-input" rows="4" value={item.text} onChange={(event) => updateItem({ text: event.target.value })} /></label>
                {showCustomization && <div className="control-grid column-item-customization">
                    <SelectControl label="Font" value={item.font || 'satoshi'} onChange={(value) => updateItem({ font: value })} options={NEWSLETTER_FONT_OPTIONS} />
                    <NumberControl label="Font size" value={item.fontSize} min={10} max={30} suffix="px" onChange={(value) => updateItem({ fontSize: value })} />
                    <SelectControl label="Font weight" value={item.fontWeight} onChange={(value) => updateItem({ fontWeight: Number(value) })} options={FONT_WEIGHTS} />
                    <ColorControl label="Text colour" value={item.color} onChange={(value) => updateItem({ color: value })} />
                    <SelectControl label="Alignment" value={item.align} onChange={(value) => updateItem({ align: value })} options={alignmentOptions} />
                    <NumberControl label="Line height" value={item.lineHeight} min={1} max={2.4} step={0.05} onChange={(value) => updateItem({ lineHeight: value })} />
                </div>}
            </>
        );
    }

    if (item.type === 'image') {
        return (
            <>
                <ExistingImage src={item.imageUrl || item.previewImageUrl} alt={item.imageUrl ? item.alt : item.previewImageAlt} fixedHeight={item.frameHeight || 150} />
                <div className="image-source-actions">
                    <ImageUploader
                        key={item.imageUrl || item.id}
                        bucket="newsletter-assets"
                        path={`designer/${blockId}/${columnId}/${item.id}`}
                        label="Upload image"
                        onUpload={(files) => updateItem({ imageUrl: files?.[0]?.url || item.imageUrl, previewImageUrl: '' })}
                        accept="image/*"
                        buttonOnly
                    />
                    <NewsletterMediaPicker
                        accessToken={mediaAccessToken}
                        onSelect={({ imageUrl, alt }) => updateItem({ imageUrl, previewImageUrl: '', alt: item.alt || alt })}
                    />
                    <details className="image-url-action">
                        <summary>Add image URL</summary>
                        <label className="field-group compact-field"><span>Image URL</span><input className="box-input" type="url" value={item.imageUrl} onChange={(event) => updateItem({ imageUrl: event.target.value, previewImageUrl: '' })} placeholder="https://…" /></label>
                    </details>
                </div>
                <div className="control-grid">
                    <label className="field-group compact-field"><span>Caption</span><input className="box-input" value={item.caption || ''} onChange={(event) => updateItem({ caption: event.target.value })} placeholder="Optional caption" /></label>
                    <label className="field-group compact-field"><span>Alt text</span><input className="box-input" value={item.alt} onChange={(event) => updateItem({ alt: event.target.value })} placeholder="Describe the image" /></label>
                </div>
                {showCustomization && <div className="control-grid column-item-customization">
                    <NumberControl label="Image width" value={item.widthPercent} min={20} max={100} step={5} suffix="%" onChange={(value) => updateItem({ widthPercent: value })} />
                    <SelectControl label="Alignment" value={item.align} onChange={(value) => updateItem({ align: value })} options={alignmentOptions} />
                    <ImageShapeControl rounded={item.rounded} onChange={(value) => updateItem({ rounded: value })} />
                </div>}
            </>
        );
    }

    if (item.type === 'button') {
        return (
            <>
                <div className="control-grid">
                    <label className="field-group compact-field"><span>Button label</span><input className="box-input" value={item.label} onChange={(event) => updateItem({ label: event.target.value })} /></label>
                    <label className="field-group compact-field"><span>Destination URL</span><input className="box-input" type="url" value={item.url} onChange={(event) => updateItem({ url: event.target.value })} placeholder="https://example.com" /></label>
                </div>
                {showCustomization && <div className="control-grid column-item-customization">
                    <ColorControl label="Button colour" value={item.buttonColor} onChange={(value) => updateItem({ buttonColor: value })} />
                    <ColorControl label="Label colour" value={item.textColor} onChange={(value) => updateItem({ textColor: value })} />
                    <SelectControl label="Alignment" value={item.align} onChange={(value) => updateItem({ align: value })} options={alignmentOptions} />
                    <SegmentControl label="Button corners" value={Boolean(item.rounded)} onChange={(value) => updateItem({ rounded: value })} options={[{ value: false, label: 'Sharp' }, { value: true, label: 'Rounded' }]} />
                </div>}
            </>
        );
    }

    if (item.type === 'link') {
        return (
            <>
                <div className="control-grid">
                    <label className="field-group compact-field"><span>Link text</span><input className="box-input" value={item.text} onChange={(event) => updateItem({ text: event.target.value })} /></label>
                    <label className="field-group compact-field"><span>HTTPS destination</span><input className="box-input" type="url" value={item.url} onChange={(event) => updateItem({ url: event.target.value })} placeholder="https://example.com" /></label>
                </div>
                {showCustomization && <div className="control-grid column-item-customization">
                    <SelectControl label="Font" value={item.font || 'satoshi'} onChange={(value) => updateItem({ font: value })} options={NEWSLETTER_FONT_OPTIONS} />
                    <ColorControl label="Link colour" value={item.color} onChange={(value) => updateItem({ color: value })} />
                    <SelectControl label="Alignment" value={item.align} onChange={(value) => updateItem({ align: value })} options={alignmentOptions} />
                    <SegmentControl label="Underline" value={item.underline !== false} onChange={(value) => updateItem({ underline: value })} options={[{ value: true, label: 'On' }, { value: false, label: 'Off' }]} />
                </div>}
            </>
        );
    }

    return null;
}

function ColumnsBlockFields({ block, updateBlock, mediaAccessToken, getRandomMediaPreview, showCustomization }) {
    const columns = Array.isArray(block.columns) ? block.columns.slice(0, block.columnCount) : [];
    const [activeColumnId, setActiveColumnId] = useState(columns[0]?.id || null);

    useEffect(() => {
        if (columns.some((column) => column.id === activeColumnId)) return;
        setActiveColumnId(columns[0]?.id || null);
    }, [columns, activeColumnId]);

    const activeColumnIndex = Math.max(0, columns.findIndex((column) => column.id === activeColumnId));
    const activeColumn = columns[activeColumnIndex];
    const items = activeColumn ? getNewsletterColumnItems(activeColumn) : [];

    const updateColumnItems = (nextItems) => updateBlock({
        columns: block.columns.map((column, index) => index === activeColumnIndex
            ? { ...column, items: nextItems }
            : column),
    });

    const updateItem = (itemIndex, patch) => updateColumnItems(
        items.map((item, index) => index === itemIndex ? { ...item, ...patch } : item),
    );

    const moveItem = (itemIndex, direction) => {
        const targetIndex = itemIndex + direction;
        if (targetIndex < 0 || targetIndex >= items.length) return;
        const nextItems = [...items];
        [nextItems[itemIndex], nextItems[targetIndex]] = [nextItems[targetIndex], nextItems[itemIndex]];
        updateColumnItems(nextItems);
    };

    const addItem = (type) => updateColumnItems([
        ...items,
        createNewsletterColumnItem(type, type === 'image' ? getRandomMediaPreview?.('image') : {}),
    ]);

    return (
        <>
            {showCustomization && <div className="column-block-customization">
            <div className="column-layout-controls">
                <SegmentControl
                    label="Layout"
                    value={block.columnCount}
                    onChange={(value) => updateBlock(resizeNewsletterColumns(block, value))}
                    options={[{ value: 2, label: '2 columns' }, { value: 3, label: '3 columns' }]}
                />
                <NumberControl label="Space between columns" value={block.gap} min={0} max={40} step={2} suffix="px" onChange={(value) => updateBlock({ gap: value })} />
            </div>
            <HorizontalEdgeControl block={block} updateBlock={updateBlock} />
            </div>}

            <div className="column-selector" role="tablist" aria-label="Choose a column to edit">
                {columns.map((column, index) => (
                    <button
                        key={column.id}
                        type="button"
                        role="tab"
                        aria-selected={column.id === activeColumn?.id}
                        className={column.id === activeColumn?.id ? 'active' : ''}
                        onClick={() => setActiveColumnId(column.id)}
                    >
                        Column {index + 1}
                        <small>{getNewsletterColumnItems(column).length} elements</small>
                    </button>
                ))}
            </div>

            {activeColumn && (
                <div className="selected-column-editor" role="tabpanel">
                    <div className="column-element-toolbar" aria-label={`Add an element to column ${activeColumnIndex + 1}`}>
                        <strong>Add to Column {activeColumnIndex + 1}</strong>
                        <div>
                            {NEWSLETTER_COLUMN_ITEM_TYPES.map((itemType) => (
                                <button key={itemType.type} type="button" onClick={() => addItem(itemType.type)}>+ {itemType.label}</button>
                            ))}
                        </div>
                    </div>

                    <div className="column-element-stack">
                        {items.map((item, itemIndex) => (
                            <div key={item.id} className="column-element-card">
                                <div className="column-element-heading">
                                    <strong>{NEWSLETTER_COLUMN_ITEM_TYPES.find((itemType) => itemType.type === item.type)?.label || 'Element'} {itemIndex + 1}</strong>
                                    <div>
                                        <button type="button" onClick={() => moveItem(itemIndex, -1)} disabled={itemIndex === 0} aria-label="Move element up">↑</button>
                                        <button type="button" onClick={() => moveItem(itemIndex, 1)} disabled={itemIndex === items.length - 1} aria-label="Move element down">↓</button>
                                        <button type="button" className="danger" onClick={() => updateColumnItems(items.filter((_, index) => index !== itemIndex))} aria-label="Delete element">×</button>
                                    </div>
                                </div>
                                <ColumnItemFields blockId={block.id} columnId={activeColumn.id} item={item} updateItem={(patch) => updateItem(itemIndex, patch)} mediaAccessToken={mediaAccessToken} showCustomization={showCustomization} />
                                {showCustomization && <NumberControl label="Space after element" value={item.spacingBottom} min={0} max={40} step={2} suffix="px" onChange={(value) => updateItem(itemIndex, { spacingBottom: value })} />}
                            </div>
                        ))}
                        {!items.length && <p className="column-empty-state">This column is empty. Add a heading, text, image, button or link.</p>}
                    </div>
                </div>
            )}
        </>
    );
}

function BlockFields({ block, updateBlock, settings, mediaAccessToken, getRandomMediaPreview, showCustomization }) {
    if (block.type === 'headingGroup') {
        return (
            <>
                <label className="field-group compact-field">
                    <span>Heading</span>
                    <textarea className="box-input" rows="2" value={block.headingText} onChange={(event) => updateBlock({ headingText: event.target.value })} placeholder="Newsletter headline" />
                </label>
                <label className="field-group compact-field">
                    <span>Subheading</span>
                    <textarea className="box-input" rows="2" value={block.subheadingText} onChange={(event) => updateBlock({ subheadingText: event.target.value })} placeholder="Supporting subheading" />
                </label>
                {showCustomization && <div className="block-customization-panel">
                    <strong className="customization-section-title">Heading style</strong>
                    <TypographyControls block={block} updateBlock={updateBlock} prefix="heading" />
                    <strong className="customization-section-title">Subheading style</strong>
                    <TypographyControls block={block} updateBlock={updateBlock} prefix="subheading" />
                    <SegmentControl
                        label="Align"
                        value={block.align || 'left'}
                        onChange={(value) => updateBlock({ align: value })}
                        options={[
                            { value: 'left', label: '←', ariaLabel: 'Align left' },
                            { value: 'center', label: '↔', ariaLabel: 'Align centre' },
                            { value: 'right', label: '→', ariaLabel: 'Align right' },
                        ]}
                    />
                </div>}
            </>
        );
    }

    if (block.type === 'heading' || block.type === 'subheading') {
        const isSubheading = block.type === 'subheading';
        return (
            <>
                <label className="field-group compact-field">
                    <span>{isSubheading ? 'Subheading' : 'Heading'}</span>
                    <textarea className="box-input" rows="3" value={block.text} onChange={(event) => updateBlock({ text: event.target.value })} placeholder={isSubheading ? 'Section subheading' : 'Newsletter headline'} />
                </label>
                {showCustomization && <div className="block-customization-panel"><TypographyControls block={block} updateBlock={updateBlock} showLineHeight lineHeightMax={2.2} /></div>}
            </>
        );
    }

    if (block.type === 'smallText') {
        return (
            <>
                <PersonalizedTextarea
                    label="Short text"
                    value={block.text}
                    onChange={(text) => updateBlock({ text })}
                    placeholder="A short supporting paragraph"
                />
                {showCustomization && <div className="block-customization-panel"><TypographyControls block={block} updateBlock={updateBlock} showLineHeight /></div>}
            </>
        );
    }

    if (block.type === 'text') {
        return (
            <>
                <InlineLinkEditor
                    value={block.text}
                    links={block.links}
                    onChange={updateBlock}
                    linkColor={block.linkColor || '#ffffff'}
                    linkFontWeight={block.linkFontWeight || 600}
                    linkFontStyle={block.linkFontStyle || 'normal'}
                    linkUnderline={block.linkUnderline !== false}
                    allowNameInsertion
                />
                <p className="field-help">Select words and use <strong>Add link</strong> or <kbd>⌘K / Ctrl+K</kbd>.</p>
                {showCustomization && <div className="block-customization-panel">
                <TypographyControls block={block} updateBlock={updateBlock} showLineHeight />
                <div className="link-style-controls">
                    <strong>Link style</strong>
                    <div className="control-grid">
                        <ColorControl label="Link colour" value={block.linkColor || '#ffffff'} onChange={(value) => updateBlock({ linkColor: value })} />
                        <SelectControl label="Link weight" value={block.linkFontWeight || 600} onChange={(value) => updateBlock({ linkFontWeight: Number(value) })} options={FONT_WEIGHTS} />
                        <SelectControl label="Link style" value={block.linkFontStyle || 'normal'} onChange={(value) => updateBlock({ linkFontStyle: value })} options={[{ value: 'normal', label: 'Normal' }, { value: 'italic', label: 'Italic' }]} />
                        <SegmentControl label="Underline" value={block.linkUnderline !== false} onChange={(value) => updateBlock({ linkUnderline: value })} options={[{ value: true, label: 'On' }, { value: false, label: 'Off' }]} />
                    </div>
                </div>
                </div>}
            </>
        );
    }

    if (block.type === 'link') {
        return (
            <>
                <div className="control-grid">
                    <label className="field-group compact-field">
                        <span>Link text</span>
                        <input className="box-input" value={block.text} onChange={(event) => updateBlock({ text: event.target.value })} placeholder="Read the full story" />
                    </label>
                    <label className="field-group compact-field">
                        <span>HTTPS destination</span>
                        <input className="box-input" type="url" value={block.url} onChange={(event) => updateBlock({ url: event.target.value })} placeholder="https://example.com" />
                    </label>
                </div>
                {showCustomization && <div className="block-customization-panel">
                <TypographyControls block={block} updateBlock={updateBlock} showLineHeight />
                <div className="control-grid">
                    <SelectControl label="Font style" value={block.fontStyle || 'normal'} onChange={(value) => updateBlock({ fontStyle: value })} options={[{ value: 'normal', label: 'Normal' }, { value: 'italic', label: 'Italic' }]} />
                    <SegmentControl label="Underline" value={block.underline !== false} onChange={(value) => updateBlock({ underline: value })} options={[{ value: true, label: 'On' }, { value: false, label: 'Off' }]} />
                </div>
                </div>}
                <p className="field-help">This block exports as clean clickable text. Use a complete link beginning with <strong>https://</strong>.</p>
            </>
        );
    }

    if (block.type === 'image' || block.type === 'gif') {
        const isGif = block.type === 'gif';
        return (
            <>
                <ExistingImage src={block.imageUrl || block.previewImageUrl} alt={block.imageUrl ? block.alt : block.previewImageAlt} />
                <div className="image-source-actions">
                    <ImageUploader
                        key={block.imageUrl || block.id}
                        bucket="newsletter-assets"
                        path={`designer/${block.id}`}
                        label={`Upload ${isGif ? 'GIF' : 'image'}`}
                        onUpload={(files) => updateBlock({ imageUrl: files?.[0]?.url || block.imageUrl, previewImageUrl: '' })}
                        accept={isGif ? 'image/gif,.gif' : 'image/*'}
                        buttonOnly
                    />
                    <NewsletterMediaPicker
                        accessToken={mediaAccessToken}
                        onSelect={({ imageUrl, alt }) => updateBlock({ imageUrl, previewImageUrl: '', alt: block.alt || alt })}
                        gifOnly={isGif}
                    />
                    <details className="image-url-action">
                        <summary>Add {isGif ? 'GIF' : 'image'} URL</summary>
                        <label className="field-group compact-field">
                            <span>{isGif ? 'GIF' : 'Image'} URL</span>
                            <input className="box-input" type="url" value={block.imageUrl} onChange={(event) => updateBlock({ imageUrl: event.target.value, previewImageUrl: '' })} placeholder="https://…" />
                        </label>
                    </details>
                </div>
                <div className="control-grid">
                    <label className="field-group compact-field">
                        <span>Caption</span>
                        <input className="box-input" value={block.caption || ''} onChange={(event) => updateBlock({ caption: event.target.value })} placeholder="Optional caption" />
                    </label>
                    <label className="field-group compact-field">
                        <span>Alt text</span>
                        <input className="box-input" value={block.alt} onChange={(event) => updateBlock({ alt: event.target.value })} placeholder={`Describe the ${isGif ? 'GIF' : 'image'}`} />
                    </label>
                </div>
                {showCustomization && <div className="block-customization-panel">
                <HorizontalEdgeControl block={block} updateBlock={updateBlock} />
                <div className="control-grid">
                    <NumberControl label={`${isGif ? 'GIF' : 'Image'} width`} value={block.widthPercent} min={20} max={100} step={5} suffix="%" onChange={(value) => updateBlock({ widthPercent: value })} />
                    <SelectControl label="Alignment" value={block.align} onChange={(value) => updateBlock({ align: value })} options={ALIGNMENTS.map((alignment) => ({ value: alignment, label: alignment[0].toUpperCase() + alignment.slice(1) }))} />
                    <ImageShapeControl rounded={block.rounded} onChange={(value) => updateBlock({ rounded: value })} />
                </div>
                </div>}
            </>
        );
    }

    if (block.type === 'button') {
        return (
            <>
                <div className="control-grid">
                    <label className="field-group compact-field">
                        <span>Button label</span>
                        <input className="box-input" value={block.label} onChange={(event) => updateBlock({ label: event.target.value })} />
                    </label>
                    <label className="field-group compact-field">
                        <span>Destination URL</span>
                        <input className="box-input" type="url" value={block.url} onChange={(event) => updateBlock({ url: event.target.value })} placeholder="https://example.com" />
                    </label>
                </div>
                {showCustomization && <div className="control-grid block-customization-panel">
                    <ColorControl label="Button colour" value={block.buttonColor} onChange={(value) => updateBlock({ buttonColor: value })} />
                    <ColorControl label="Label colour" value={block.textColor} onChange={(value) => updateBlock({ textColor: value })} />
                    <NumberControl label="Font size" value={block.fontSize} min={11} max={28} suffix="px" onChange={(value) => updateBlock({ fontSize: value })} />
                    <SelectControl label="Font weight" value={block.fontWeight} onChange={(value) => updateBlock({ fontWeight: Number(value) })} options={FONT_WEIGHTS} />
                    <SelectControl label="Alignment" value={block.align} onChange={(value) => updateBlock({ align: value })} options={ALIGNMENTS.map((alignment) => ({ value: alignment, label: alignment[0].toUpperCase() + alignment.slice(1) }))} />
                    <SegmentControl label="Button corners" value={Boolean(block.rounded)} onChange={(value) => updateBlock({ rounded: value })} options={[{ value: false, label: 'Sharp' }, { value: true, label: 'Rounded' }]} />
                </div>}
            </>
        );
    }

    if (block.type === 'divider') {
        if (!showCustomization) return <div className="structural-block-placeholder divider-placeholder" aria-hidden="true"><span style={{ borderTopColor: block.color, borderTopWidth: `${block.thickness}px` }} /></div>;
        return (
            <div className="control-grid">
                <ColorControl label="Divider colour" value={block.color} onChange={(value) => updateBlock({ color: value })} />
                <NumberControl label="Thickness" value={block.thickness} min={1} max={8} suffix="px" onChange={(value) => updateBlock({ thickness: value })} />
            </div>
        );
    }

    if (block.type === 'spacer') {
        if (!showCustomization) return <div className="structural-block-placeholder spacer-placeholder" aria-hidden="true" />;
        const usesEmailBackground = !block.backgroundColor;
        return (
            <div className="spacer-block-controls">
                <NumberControl
                    label="Spacer height"
                    value={block.height}
                    min={0}
                    max={240}
                    step={4}
                    suffix="px"
                    onChange={(value) => updateBlock({ height: value })}
                />
                <label className="inherit-background-toggle">
                    <input
                        type="checkbox"
                        checked={usesEmailBackground}
                        onChange={(event) => updateBlock({
                            backgroundColor: event.target.checked ? null : settings.canvasBackgroundColor,
                        })}
                    />
                    Match the email background
                </label>
                {!usesEmailBackground && (
                    <ColorControl
                        label="Spacer colour"
                        value={block.backgroundColor || settings.canvasBackgroundColor}
                        onChange={(value) => updateBlock({ backgroundColor: value })}
                    />
                )}
                <p className="field-help">Move this block anywhere in the email to create intentional blank space.</p>
            </div>
        );
    }

    if (block.type === 'columns') {
        return <ColumnsBlockFields block={block} updateBlock={updateBlock} mediaAccessToken={mediaAccessToken} getRandomMediaPreview={getRandomMediaPreview} showCustomization={showCustomization} />;
    }

    if (block.type === 'footer') {
        return (
            <>
                <div className="control-grid">
                    <label className="field-group compact-field"><span>Brand name</span><input className="box-input" value={block.brandName} onChange={(event) => updateBlock({ brandName: event.target.value })} /></label>
                    <label className="field-group compact-field"><span>Website label</span><input className="box-input" value={block.websiteLabel} onChange={(event) => updateBlock({ websiteLabel: event.target.value })} /></label>
                    <label className="field-group compact-field"><span>Website URL</span><input className="box-input" type="url" value={block.websiteUrl} onChange={(event) => updateBlock({ websiteUrl: event.target.value })} /></label>
                </div>
                <label className="field-group compact-field"><span>Footer message</span><textarea className="box-input" rows="4" value={block.message} onChange={(event) => updateBlock({ message: event.target.value })} /></label>
                {showCustomization && <div className="control-grid block-customization-panel">
                    <SelectControl label="Font" value={block.font || 'satoshi'} onChange={(value) => updateBlock({ font: value })} options={NEWSLETTER_FONT_OPTIONS} />
                    <ColorControl label="Text colour" value={block.color} onChange={(value) => updateBlock({ color: value })} />
                    <ColorControl label="Link colour" value={block.linkColor} onChange={(value) => updateBlock({ linkColor: value })} />
                    <NumberControl label="Font size" value={block.fontSize} min={10} max={22} suffix="px" onChange={(value) => updateBlock({ fontSize: value })} />
                    <SelectControl label="Font weight" value={block.fontWeight} onChange={(value) => updateBlock({ fontWeight: Number(value) })} options={FONT_WEIGHTS} />
                    <SelectControl label="Alignment" value={block.align} onChange={(value) => updateBlock({ align: value })} options={ALIGNMENTS.map((alignment) => ({ value: alignment, label: alignment[0].toUpperCase() + alignment.slice(1) }))} />
                </div>}
                <p className="field-help">The unsubscribe link is always included automatically.</p>
            </>
        );
    }

    return null;
}

const blockLabel = (block) => NEWSLETTER_BLOCK_TYPES.find((item) => item.type === block.type)?.label || 'Block';

function SortableNewsletterBlock({
    block,
    index,
    isExpanded,
    onToggle,
    onOpen,
    onDuplicate,
    onDelete,
    onUpdate,
    settings,
    mediaAccessToken,
    getRandomMediaPreview,
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
    const [showCustomization, setShowCustomization] = useState(false);

    useEffect(() => {
        if (!isExpanded) setShowCustomization(false);
    }, [isExpanded]);

    const toggleCustomization = () => {
        if (!isExpanded) onOpen();
        setShowCustomization((current) => !current);
    };

    return (
        <article
            id={`newsletter-block-${block.id}`}
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={`newsletter-block-card ${isExpanded ? 'expanded' : ''} ${isDragging ? 'is-dragging' : ''}`}
        >
            <header className="block-card-header">
                <button
                    type="button"
                    className="newsletter-block-drag-handle"
                    {...attributes}
                    {...listeners}
                    aria-label={`Drag ${blockLabel(block)} to change its position`}
                    title="Drag to reorder"
                >
                    <span className="drag-dot-grid" aria-hidden="true">
                        {Array.from({ length: 6 }, (_, dotIndex) => <span key={dotIndex} />)}
                    </span>
                </button>
                <button
                    type="button"
                    className="block-card-toggle"
                    onClick={onToggle}
                    aria-expanded={isExpanded}
                >
                    <span className="block-order">{index + 1}</span>
                    <span className="block-card-title">
                        <strong>{blockLabel(block)}</strong>
                        {block.type === 'footer' && <small>Required branded sign-off</small>}
                        {block.type === 'spacer' && <small>{block.height}px blank space</small>}
                    </span>
                    <span className="block-toggle-chevron" aria-hidden="true" />
                </button>
                <div className="block-card-actions">
                    <button
                        type="button"
                        className={`customize ${showCustomization ? 'active' : ''}`}
                        onClick={toggleCustomization}
                        aria-expanded={showCustomization}
                    >
                        {showCustomization ? 'Close customization' : 'Customize'}
                    </button>
                    {block.type !== 'footer' && <button type="button" className="duplicate" onClick={onDuplicate}>Duplicate</button>}
                    {block.type !== 'footer' && <button type="button" className="danger" onClick={onDelete}>Remove</button>}
                </div>
            </header>
            {isExpanded && (
                <div className="block-card-body">
                    <BlockFields
                        block={block}
                        updateBlock={onUpdate}
                        settings={settings}
                        mediaAccessToken={mediaAccessToken}
                        getRandomMediaPreview={getRandomMediaPreview}
                        showCustomization={showCustomization}
                    />
                    {block.type !== 'spacer' && showCustomization && (
                        <SectionControls block={block} settings={settings} updateBlock={onUpdate} />
                    )}
                </div>
            )}
        </article>
    );
}

export function NewsletterBlockInsertToolbar({ blocks, onAddBlock }) {
    return (
        <section className="block-insert-toolbar" aria-labelledby="add-block-title">
            <div className="block-insert-heading">
                <strong id="add-block-title">Insert a block</strong>
            </div>
            <div className="add-block-grid">
                {NEWSLETTER_BLOCK_TYPES.filter((item) => item.type !== 'footer' || !blocks.some((block) => block.type === 'footer')).map((item) => (
                    <button key={item.type} type="button" onClick={() => onAddBlock(item.type)} title={item.description}>
                        <span className="add-block-plus" aria-hidden="true">+</span>
                        <strong>{item.label}</strong>
                    </button>
                ))}
            </div>
        </section>
    );
}

export default function NewsletterBlockEditor({ blocks, onChange, settings, focusBlockId, mediaAccessToken, getRandomMediaPreview }) {
    const [expandedBlockIds, setExpandedBlockIds] = useState(() => new Set(blocks[0]?.id ? [blocks[0].id] : []));
    const [pendingBlockId, setPendingBlockId] = useState(null);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    useEffect(() => {
        if (!focusBlockId) return;
        setExpandedBlockIds((currentIds) => {
            if (currentIds.has(focusBlockId)) return currentIds;
            const nextIds = new Set(currentIds);
            nextIds.add(focusBlockId);
            return nextIds;
        });
        setPendingBlockId(focusBlockId);
    }, [focusBlockId]);

    useEffect(() => {
        const validBlockIds = new Set(blocks.map((block) => block.id));
        setExpandedBlockIds((currentIds) => {
            const nextIds = new Set([...currentIds].filter((id) => validBlockIds.has(id)));
            return nextIds.size === currentIds.size ? currentIds : nextIds;
        });
    }, [blocks]);

    useEffect(() => {
        if (!pendingBlockId) return undefined;
        const frame = requestAnimationFrame(() => {
            const blockElement = document.getElementById(`newsletter-block-${pendingBlockId}`);
            if (!blockElement) {
                setPendingBlockId(null);
                return;
            }
            const editorScroller = blockElement.closest('.design-editor-panel');
            const canScrollInsideEditor = editorScroller
                && editorScroller.scrollHeight > editorScroller.clientHeight;

            if (canScrollInsideEditor) {
                const scrollerRect = editorScroller.getBoundingClientRect();
                const blockRect = blockElement.getBoundingClientRect();
                const centeredOffset = Math.max(24, (editorScroller.clientHeight - blockElement.offsetHeight) / 2);
                editorScroller.scrollTo({
                    top: editorScroller.scrollTop + blockRect.top - scrollerRect.top - centeredOffset,
                    behavior: 'smooth',
                });
            } else {
                blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            setPendingBlockId(null);
        });
        return () => cancelAnimationFrame(frame);
    }, [blocks, pendingBlockId]);

    const updateBlockAt = (index, patch) => {
        onChange(blocks.map((block, blockIndex) => blockIndex === index ? { ...block, ...patch } : block));
    };

    const reorderBlocks = ({ active, over }) => {
        if (!over || active.id === over.id) return;
        const oldIndex = blocks.findIndex((block) => block.id === active.id);
        const newIndex = blocks.findIndex((block) => block.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;
        onChange(arrayMove(blocks, oldIndex, newIndex));
    };

    const duplicateBlock = (index) => {
        const duplicate = cloneNewsletterBlock(blocks[index]);
        const nextBlocks = [...blocks];
        nextBlocks.splice(index + 1, 0, duplicate);
        onChange(nextBlocks);
        setExpandedBlockIds((currentIds) => new Set(currentIds).add(duplicate.id));
        setPendingBlockId(duplicate.id);
    };

    const deleteBlock = (index) => {
        const block = blocks[index];
        if (block.type === 'footer') return;
        const nextBlocks = blocks.filter((_, blockIndex) => blockIndex !== index);
        onChange(nextBlocks);
        setExpandedBlockIds((currentIds) => {
            if (!currentIds.has(block.id)) return currentIds;
            const nextIds = new Set(currentIds);
            nextIds.delete(block.id);
            return nextIds;
        });
    };

    const toggleBlock = (blockId) => {
        setExpandedBlockIds((currentIds) => {
            const nextIds = new Set(currentIds);
            if (nextIds.has(blockId)) nextIds.delete(blockId);
            else nextIds.add(blockId);
            return nextIds;
        });
    };

    const openBlock = (blockId) => {
        setExpandedBlockIds((currentIds) => {
            if (currentIds.has(blockId)) return currentIds;
            return new Set(currentIds).add(blockId);
        });
    };

    return (
        <div className="newsletter-block-editor">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderBlocks}>
                <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
                    <div className="block-stack" aria-label="Newsletter content blocks">
                        {blocks.map((block, index) => (
                            <SortableNewsletterBlock
                                key={block.id}
                                block={block}
                                index={index}
                                isExpanded={expandedBlockIds.has(block.id)}
                                onToggle={() => toggleBlock(block.id)}
                                onOpen={() => openBlock(block.id)}
                                onDuplicate={() => duplicateBlock(index)}
                                onDelete={() => deleteBlock(index)}
                                onUpdate={(patch) => updateBlockAt(index, patch)}
                                settings={settings}
                                mediaAccessToken={mediaAccessToken}
                                getRandomMediaPreview={getRandomMediaPreview}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    );
}
