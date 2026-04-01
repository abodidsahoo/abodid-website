import { AlertTriangle } from 'lucide-react';

type ErrorStateProps = {
    title: string;
    message: string;
};

export default function ErrorState({ title, message }: ErrorStateProps) {
    return (
        <div className="rw-error-state" role="alert">
            <div className="rw-error-state__icon" aria-hidden="true">
                <AlertTriangle size={18} />
            </div>
            <div>
                <h3>{title}</h3>
                <p>{message}</p>
            </div>
        </div>
    );
}
