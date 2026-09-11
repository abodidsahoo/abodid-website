import React from 'react';
import ViewportGestureCardStack from './ViewportGestureCardStack';

const GestureImagePreviewLab = ({ images = [] }) => {
    return (
        <ViewportGestureCardStack
            images={images}
            backLinkHref="/lab"
            backLinkLabel="Back to Lab"
            kicker="Gesture Photo Stack"
            title="Image Flick"
            description="Photographs emerge through cursor movement, hand tracking, deliberate pinch-based resizing, and optional voice input."
        />
    );
};

export default GestureImagePreviewLab;
