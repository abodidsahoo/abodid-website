import { ArrowRight, FilePenLine, Sparkles } from 'lucide-react';

export default function WorkspaceModePicker() {
    return (
        <section className="rw-mode-picker">
            <a className="rw-mode-card" href="/research-workspace/renamer">
                <div className="rw-mode-card__icon" aria-hidden="true">
                    <FilePenLine size={20} />
                </div>
                <div className="rw-mode-card__copy">
                    <p className="rw-section-heading__eyebrow">Research Paper Renamer</p>
                    <h2>Rename papers into a clean, consistent structure</h2>
                    <p>
                        Upload one PDF or a whole batch, get clean filenames instantly,
                        preview the renamed result, and download papers one by one or all at once.
                    </p>
                </div>
                <div className="rw-mode-card__cta">
                    <span>Open Renamer</span>
                    <ArrowRight size={16} />
                </div>
            </a>

            <a className="rw-mode-card" href="/research-workspace/insights">
                <div className="rw-mode-card__icon rw-mode-card__icon--insights" aria-hidden="true">
                    <Sparkles size={20} />
                </div>
                <div className="rw-mode-card__copy">
                    <p className="rw-section-heading__eyebrow">Insights Generator</p>
                    <h2>Upload a paper and generate a readable insight summary</h2>
                    <p>
                        Add a paper directly inside the insights flow, process it page by page,
                        generate structured takeaways, and still download the clean renamed PDF.
                    </p>
                </div>
                <div className="rw-mode-card__cta">
                    <span>Open Insights</span>
                    <ArrowRight size={16} />
                </div>
            </a>
        </section>
    );
}
