export function createNewsletterDelivery({
    fromAddress,
    recipientEmail,
    subject,
    htmlContent,
}) {
    return {
        from: fromAddress,
        to: recipientEmail,
        subject,
        html: htmlContent,
    };
}
