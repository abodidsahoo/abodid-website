
/**
 * Detects the performance tier of the user's device.
 * Returns 'high' for powerful devices (desktops/laptops with decent specs)
 * and 'low' for mobile devices or constrained environments.
 */
export const getPerformanceTier = () => {
    if (typeof navigator === 'undefined') return 'high'; // SSR default

    // 1. Mobile Check (Heuristic)
    // Most phones/tablets struggle with high-res Canvas grain on many images.
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) return 'low';

    // 2. Hardware Concurrency (CPU Cores)
    // 4 cores is a reasonable baseline for a "powerful" visual experience.
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
        return 'low';
    }

    // 3. Device Memory (RAM in GB) - Experimental API
    // If available, < 4GB is considered low end for this site.
    // @ts-ignore
    if (navigator.deviceMemory && navigator.deviceMemory < 4) {
        return 'low';
    }

    // Default to high for Desktops/Laptops that pass the above checks.
    return 'high';
};
