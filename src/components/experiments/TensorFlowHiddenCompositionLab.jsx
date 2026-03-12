import React from 'react';
import ViewportGestureCardStack from './ViewportGestureCardStack';

const TensorFlowHiddenCompositionLab = ({ images = [] }) => {
    return (
        <ViewportGestureCardStack
            images={images}
            backLinkHref="/research/tensorflow-hidden-composition"
            backLinkLabel="Back to Project Details"
            secondaryLinkHref="/research/tensorflow-gesture-controls"
            secondaryLinkLabel="View the earlier TensorFlow controls study"
            kicker="TensorFlow.js Research Prototype"
            title="TensorFlow Hidden Composition"
            description="A TensorFlow.js launch scaffold for the Hidden Composition study, using the existing photography card source while the full abstraction-and-reveal interaction is developed."
            handTrackingEngine="tensorflow"
            handTrackingModelType="full"
        />
    );
};

export default TensorFlowHiddenCompositionLab;
