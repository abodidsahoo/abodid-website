import React from 'react';
import ViewportGestureCardStack from './ViewportGestureCardStack';

const GestureImagePreviewLab = ({ images = [] }) => {
    return (
        <ViewportGestureCardStack
            images={images}
            backLinkHref="/research/gesture-image-preview"
            backLinkLabel="Back to Project Details"
            kicker="Interactive Prototype"
            title="Gesture Photo Stack"
            description="Photographs emerge through cursor movement, hand tracking, deliberate pinch-based resizing, and optional voice input."
        />
    );
};

export default GestureImagePreviewLab;
