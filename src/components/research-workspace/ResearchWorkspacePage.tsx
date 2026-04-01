import { Compass } from 'lucide-react';
import WorkspaceModePicker from './WorkspaceModePicker';

export default function ResearchWorkspacePage() {
    return (
        <section className="rw-page">
            <div className="rw-stage">
                <header className="rw-hero rw-hero--landing">
                    <div className="rw-eyebrow">
                        <Compass size={14} />
                        <span>Abodid Paper Renamer</span>
                    </div>
                    <h1>Paper Renamer</h1>
                    <p>
                        Choose a dedicated path for renaming papers cleanly or generating structured insights from a PDF.
                    </p>
                </header>

                <div className="rw-workspace-card">
                    <WorkspaceModePicker />
                </div>
            </div>
        </section>
    );
}
