/**
 * Project Info Modal Handler
 * Manages the opening/closing of the project information modal
 */

(() => {
    'use strict';

    function initProjectInfoModal() {
        const modal = document.getElementById('project-info-modal');
        const openBtn = document.getElementById('project-info-btn');
        const closeBtn = document.getElementById('project-info-close');
        const backdrop = document.getElementById('project-info-backdrop');

        if (!modal || !openBtn || !closeBtn || !backdrop) {
            console.warn('Project info modal elements not found');
            return;
        }

        // Open modal
        function openModal() {
            modal.classList.add('is-open');
            modal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }

        // Close modal
        function closeModal() {
            modal.classList.remove('is-open');
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = ''; // Restore scrolling
        }

        // Event listeners
        openBtn.addEventListener('click', openModal);
        closeBtn.addEventListener('click', closeModal);
        backdrop.addEventListener('click', closeModal);

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('is-open')) {
                closeModal();
            }
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initProjectInfoModal);
    } else {
        initProjectInfoModal();
    }
})();
