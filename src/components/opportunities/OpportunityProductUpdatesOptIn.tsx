import React, { useId } from 'react';
import { PRODUCT_UPDATES_CONSENT_TEXT } from '../../lib/opportunities/productUpdates';

export function OpportunityProductUpdatesOptIn({ checked, onChange, disabled = false }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}) {
    const id = useId();
    return <div className="opp-product-updates-opt-in">
        <label htmlFor={id}>
            <input id={id} name="product_updates_opt_in" type="checkbox" checked={checked}
                onChange={(event) => onChange(event.target.checked)} disabled={disabled} aria-describedby={`${id}-hint`} />
            <span>{PRODUCT_UPDATES_CONSENT_TEXT}</span>
        </label>
        <p id={`${id}-hint`}>Optional. Change this in your profile at any time.</p>
    </div>;
}
