import React from 'react';

class LandingStackErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            errorMessage: '',
        };
        this.handleRefresh = this.handleRefresh.bind(this);
    }

    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            errorMessage: error?.message || 'A runtime error interrupted the landing stack.',
        };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Landing stack boundary caught an error:', error, errorInfo);
    }

    handleRefresh() {
        window.location.reload();
    }

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        return (
            <div className="landing-stack-runtime-fallback" role="alert" aria-live="assertive">
                <p>{this.state.errorMessage}</p>
                <p className="landing-stack-runtime-subtext">
                    Could you please refresh the page? This usually restores the stack instantly.
                </p>
                <button type="button" onClick={this.handleRefresh}>
                    Refresh Page
                </button>
                <style>{`
                    .landing-stack-runtime-fallback {
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        z-index: 10030;
                        width: min(560px, 88vw);
                        padding: 18px 20px;
                        border-radius: 12px;
                        border: 1px solid rgba(0, 0, 0, 0.14);
                        background: rgba(255, 255, 255, 0.97);
                        backdrop-filter: blur(8px);
                        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.16);
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 8px;
                        text-align: center;
                    }
                    .landing-stack-runtime-fallback p {
                        margin: 0;
                        color: rgba(0, 0, 0, 0.86);
                        font-family: var(--font-ui);
                        font-size: 0.86rem;
                        line-height: 1.45;
                        letter-spacing: 0.03em;
                    }
                    .landing-stack-runtime-fallback .landing-stack-runtime-subtext {
                        font-size: 0.79rem;
                        color: rgba(0, 0, 0, 0.7);
                    }
                    .landing-stack-runtime-fallback button {
                        border: 1px solid rgba(0, 0, 0, 0.45);
                        border-radius: 8px;
                        background: #ffffff;
                        color: rgba(0, 0, 0, 0.86);
                        font-family: var(--font-ui);
                        font-size: 0.74rem;
                        font-weight: 600;
                        line-height: 1.1;
                        letter-spacing: 0.04em;
                        text-transform: uppercase;
                        padding: 0.54rem 0.86rem;
                        cursor: pointer;
                    }
                    .landing-stack-runtime-fallback button:hover {
                        border-color: rgba(56, 189, 248, 0.86);
                        background: rgba(56, 189, 248, 0.12);
                    }
                `}</style>
            </div>
        );
    }
}

export default LandingStackErrorBoundary;
