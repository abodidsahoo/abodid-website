import React from 'react';
import LandingOrchestrator from './LandingOrchestrator';
import LandingStackErrorBoundary from './LandingStackErrorBoundary';

const LandingStackShell = (props) => {
    return (
        <LandingStackErrorBoundary>
            <LandingOrchestrator {...props} />
        </LandingStackErrorBoundary>
    );
};

export default LandingStackShell;
