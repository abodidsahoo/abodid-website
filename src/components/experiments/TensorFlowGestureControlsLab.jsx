import React from 'react';
import ViewportGestureCardStack from './ViewportGestureCardStack';

const TensorFlowGestureControlsLab = ({ images = [] }) => {
    return (
        <ViewportGestureCardStack
            images={images}
            backLinkHref="/research/tensorflow-gesture-controls"
            backLinkLabel="Back to Project Details"
            secondaryLinkHref="/research/gesture-image-preview"
            secondaryLinkLabel="Check the similar experiment done with MediaPipe"
            kicker="TensorFlow.js Prototype"
            title="TensorFlow Gesture Controls"
            description="A TensorFlow.js version of the photo-stack experiment for testing custom gesture logic, model tuning, and future classifier work."
            handTrackingEngine="tensorflow"
            handTrackingModelType="lite"
        />
    );
};

export default TensorFlowGestureControlsLab;
