import type { ScratchDirection } from "./ScratchAudioEngine";

export type ScratchPlatterState = {
    angle: number;
    velocity: number;
    rawVelocity: number;
    acceleration: number;
    direction: ScratchDirection;
    deltaAngle: number;
    deltaSeconds: number;
    gestureDuration: number;
    pointerTravel: number;
    isDragging: boolean;
    nowMs: number;
};

export type ScratchPlatterOptions = {
    element: HTMLElement;
    idleAngularVelocity?: number;
    onStart?: (state: ScratchPlatterState) => void;
    onMove?: (state: ScratchPlatterState) => void;
    onRelease?: (state: ScratchPlatterState) => void;
};

export const SCRATCH_PLATTER_TUNING = {
    idleAngularVelocity: 0.43,
    maxAngularVelocity: 18,
    previousVelocityWeight: 0.42,
    currentVelocityWeight: 0.58,
    returnToIdleStrength: 1.45,
    minimumDeltaSeconds: 1 / 240,
    maximumDeltaSeconds: 0.08,
    centreDeadZoneRatio: 0.055,
} as const;

const clamp = (value: number, minimum: number, maximum: number) =>
    Math.min(Math.max(value, minimum), maximum);

const normalizeAngle = (angle: number) => {
    let normalized = angle;
    while (normalized > Math.PI) normalized -= Math.PI * 2;
    while (normalized < -Math.PI) normalized += Math.PI * 2;
    return normalized;
};

const cubicEaseInOut = (progress: number) =>
    progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

export class ScratchPlatterController {
    private element: HTMLElement;
    private idleAngularVelocity: number;
    private onStart?: ScratchPlatterOptions["onStart"];
    private onMove?: ScratchPlatterOptions["onMove"];
    private onRelease?: ScratchPlatterOptions["onRelease"];
    private angle = 0;
    private velocity = 0;
    private rawVelocity = 0;
    private acceleration = 0;
    private dragging = false;
    private clickOnlyGesture = false;
    private pointerId = -1;
    private centreX = 0;
    private centreY = 0;
    private previousPointerAngle = 0;
    private previousPointerTime = 0;
    private previousPointerX = 0;
    private previousPointerY = 0;
    private pointerTravel = 0;
    private previousRawVelocity = 0;
    private gestureStartedAt = 0;
    private lastFrame = performance.now();
    private velocityTransition: {
        from: number;
        to: number;
        startedAt: number;
        durationMs: number;
    } | null = null;

    constructor(options: ScratchPlatterOptions) {
        this.element = options.element;
        this.idleAngularVelocity =
            options.idleAngularVelocity ?? SCRATCH_PLATTER_TUNING.idleAngularVelocity;
        this.velocity = this.idleAngularVelocity;
        this.onStart = options.onStart;
        this.onMove = options.onMove;
        this.onRelease = options.onRelease;

        this.element.addEventListener("pointerdown", this.handlePointerDown);
        this.element.addEventListener("pointermove", this.handlePointerMove);
        this.element.addEventListener("pointerup", this.handlePointerEnd);
        this.element.addEventListener("pointercancel", this.handlePointerEnd);
        this.element.addEventListener("lostpointercapture", this.handleLostCapture);
        window.addEventListener("blur", this.handleWindowBlur);
        document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }

    get isDragging() {
        return this.dragging;
    }

    get angularVelocity() {
        return this.velocity;
    }

    setIdleAngularVelocity(angularVelocity: number, transitionDurationMs = 0) {
        const targetUnchanged =
            Math.abs(this.idleAngularVelocity - angularVelocity) < 0.000001 &&
            (!this.velocityTransition ||
                Math.abs(this.velocityTransition.to - angularVelocity) < 0.000001);
        this.idleAngularVelocity = angularVelocity;

        if (targetUnchanged) return;

        if (this.dragging) {
            this.velocityTransition = null;
            return;
        }

        if (transitionDurationMs <= 0) {
            this.velocityTransition = null;
            this.velocity = angularVelocity;
            this.rawVelocity = angularVelocity;
            this.acceleration = 0;
            return;
        }

        this.velocityTransition = {
            from: this.velocity,
            to: angularVelocity,
            startedAt: performance.now(),
            durationMs: transitionDurationMs,
        };
    }

    tick(nowMs: number): ScratchPlatterState {
        const deltaSeconds = clamp(
            (nowMs - this.lastFrame) / 1000,
            0,
            0.05,
        );
        this.lastFrame = nowMs;

        if (!this.dragging) {
            if (this.velocityTransition) {
                const progress = clamp(
                    (nowMs - this.velocityTransition.startedAt) /
                        this.velocityTransition.durationMs,
                    0,
                    1,
                );
                const easedProgress = cubicEaseInOut(progress);
                this.velocity =
                    this.velocityTransition.from +
                    (this.velocityTransition.to - this.velocityTransition.from) *
                        easedProgress;
                this.rawVelocity = this.velocity;

                if (progress >= 1) {
                    this.velocity = this.velocityTransition.to;
                    this.rawVelocity = this.velocityTransition.to;
                    this.velocityTransition = null;
                }
            } else {
                const returnStrength = 1 - Math.exp(
                    -deltaSeconds * SCRATCH_PLATTER_TUNING.returnToIdleStrength,
                );
                this.velocity +=
                    (this.idleAngularVelocity - this.velocity) * returnStrength;
            }
            this.angle += this.velocity * deltaSeconds;
        }

        this.element.style.transform = `rotate(${this.angle}rad)`;
        return this.snapshot(nowMs, deltaSeconds, 0);
    }

    nudge(direction: ScratchDirection, velocity = 5.5) {
        this.velocityTransition = null;
        this.velocity = direction * Math.abs(velocity);
        this.rawVelocity = this.velocity;
        this.angle += direction * 0.09;
        this.element.style.transform = `rotate(${this.angle}rad)`;
        return this.snapshot(performance.now(), 0, direction * 0.09);
    }

    destroy() {
        if (this.dragging) {
            this.dragging = false;
            if (
                this.pointerId >= 0 &&
                this.element.hasPointerCapture(this.pointerId)
            ) {
                this.element.releasePointerCapture(this.pointerId);
            }
            this.pointerId = -1;
        }
        this.element.removeEventListener("pointerdown", this.handlePointerDown);
        this.element.removeEventListener("pointermove", this.handlePointerMove);
        this.element.removeEventListener("pointerup", this.handlePointerEnd);
        this.element.removeEventListener("pointercancel", this.handlePointerEnd);
        this.element.removeEventListener("lostpointercapture", this.handleLostCapture);
        window.removeEventListener("blur", this.handleWindowBlur);
        document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    }

    private handlePointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        event.preventDefault();
        this.velocityTransition = null;

        const bounds = this.element.getBoundingClientRect();
        this.centreX = bounds.left + bounds.width / 2;
        this.centreY = bounds.top + bounds.height / 2;
        const distance = Math.hypot(
            event.clientX - this.centreX,
            event.clientY - this.centreY,
        );
        const untransformedSize = Math.min(
            this.element.offsetWidth,
            this.element.offsetHeight,
        );
        this.clickOnlyGesture =
            distance < untransformedSize * SCRATCH_PLATTER_TUNING.centreDeadZoneRatio;

        const nowMs = performance.now();
        this.dragging = true;
        this.pointerId = event.pointerId;
        this.previousPointerAngle = this.pointerAngle(event);
        this.previousPointerTime = nowMs;
        this.previousPointerX = event.clientX;
        this.previousPointerY = event.clientY;
        this.pointerTravel = 0;
        this.previousRawVelocity = this.velocity;
        this.gestureStartedAt = nowMs;
        this.element.setPointerCapture(event.pointerId);
        this.onStart?.(this.snapshot(nowMs, 0, 0));
    };

    private handlePointerMove = (event: PointerEvent) => {
        if (!this.dragging || event.pointerId !== this.pointerId) return;
        event.preventDefault();

        const nowMs = performance.now();
        this.pointerTravel += Math.hypot(
            event.clientX - this.previousPointerX,
            event.clientY - this.previousPointerY,
        );
        this.previousPointerX = event.clientX;
        this.previousPointerY = event.clientY;

        if (this.clickOnlyGesture) {
            const distance = Math.hypot(
                event.clientX - this.centreX,
                event.clientY - this.centreY,
            );
            const untransformedSize = Math.min(
                this.element.offsetWidth,
                this.element.offsetHeight,
            );
            this.onMove?.(this.snapshot(nowMs, 0, 0));
            if (
                distance <
                untransformedSize * SCRATCH_PLATTER_TUNING.centreDeadZoneRatio
            ) return;

            // Establish a stable angle once a centre-originating drag reaches
            // the playable record surface, then scratch from the next move.
            this.clickOnlyGesture = false;
            this.previousPointerAngle = this.pointerAngle(event);
            this.previousPointerTime = nowMs;
            this.previousRawVelocity = this.velocity;
            return;
        }

        const nextPointerAngle = this.pointerAngle(event);
        const deltaAngle = normalizeAngle(nextPointerAngle - this.previousPointerAngle);
        const deltaSeconds = clamp(
            (nowMs - this.previousPointerTime) / 1000,
            SCRATCH_PLATTER_TUNING.minimumDeltaSeconds,
            SCRATCH_PLATTER_TUNING.maximumDeltaSeconds,
        );
        this.rawVelocity = clamp(
            deltaAngle / deltaSeconds,
            -SCRATCH_PLATTER_TUNING.maxAngularVelocity,
            SCRATCH_PLATTER_TUNING.maxAngularVelocity,
        );
        this.acceleration = (this.rawVelocity - this.previousRawVelocity) / deltaSeconds;
        this.velocity =
            this.velocity * SCRATCH_PLATTER_TUNING.previousVelocityWeight +
            this.rawVelocity * SCRATCH_PLATTER_TUNING.currentVelocityWeight;
        this.angle += deltaAngle;
        this.element.style.transform = `rotate(${this.angle}rad)`;

        this.onMove?.(this.snapshot(nowMs, deltaSeconds, deltaAngle));
        this.previousPointerAngle = nextPointerAngle;
        this.previousPointerTime = nowMs;
        this.previousRawVelocity = this.rawVelocity;
    };

    private handlePointerEnd = (event: PointerEvent) => {
        if (!this.dragging || event.pointerId !== this.pointerId) return;
        this.finishGesture(event);
    };

    private handleLostCapture = () => {
        if (this.dragging) this.finishGesture();
    };

    private handleWindowBlur = () => {
        if (this.dragging) this.finishGesture();
    };

    private handleVisibilityChange = () => {
        if (document.hidden && this.dragging) this.finishGesture();
    };

    private finishGesture(event?: PointerEvent) {
        if (!this.dragging) return;
        const nowMs = performance.now();
        this.dragging = false;
        if (event && this.element.hasPointerCapture(event.pointerId)) {
            this.element.releasePointerCapture(event.pointerId);
        }
        this.pointerId = -1;
        this.onRelease?.(this.snapshot(nowMs, 0, 0));
        this.clickOnlyGesture = false;
    }

    private pointerAngle(event: PointerEvent) {
        return Math.atan2(
            event.clientY - this.centreY,
            event.clientX - this.centreX,
        );
    }

    private snapshot(nowMs: number, deltaSeconds: number, deltaAngle: number): ScratchPlatterState {
        const direction = deltaAngle === 0
            ? (this.velocity < 0 ? -1 : 1)
            : (deltaAngle < 0 ? -1 : 1);

        return {
            angle: this.angle,
            velocity: this.velocity,
            rawVelocity: this.rawVelocity,
            acceleration: this.acceleration,
            direction,
            deltaAngle,
            deltaSeconds,
            gestureDuration: Math.max(0, nowMs - this.gestureStartedAt),
            pointerTravel: this.pointerTravel,
            isDragging: this.dragging,
            nowMs,
        };
    }
}
