import assert from 'node:assert/strict';
import test from 'node:test';

import { createNewsletterDelivery } from '../../src/lib/newsletter/deliveryPayload.js';

test('newsletter deliveries go only to the intended recipient', () => {
    const delivery = createNewsletterDelivery({
        fromAddress: 'Abodid <newsletter@abodid.com>',
        recipientEmail: 'reader@example.com',
        subject: 'A new newsletter',
        htmlContent: '<p>Hello</p>',
    });

    assert.deepEqual(delivery, {
        from: 'Abodid <newsletter@abodid.com>',
        to: 'reader@example.com',
        subject: 'A new newsletter',
        html: '<p>Hello</p>',
    });
    assert.equal(Object.hasOwn(delivery, 'bcc'), false);
    assert.equal(Object.hasOwn(delivery, 'headers'), false);
});
