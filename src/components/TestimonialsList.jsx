import React from "react";

const TestimonialsList = ({ testimonials = [] }) => {
    if (!testimonials || testimonials.length === 0) {
        return <div>No testimonials found.</div>;
    }

    return (
        <div className="flex flex-col gap-8">
            {testimonials.map((t) => (
                <div key={t.id} className="testimonial-item">
                    {/* Render content as HTML since user specified "HTML-based content" */}
                    <div dangerouslySetInnerHTML={{ __html: t.content }} />

                    <div className="mt-4">
                        <p><strong>{t.name}</strong></p>
                        <p>{t.role}{t.company && `, ${t.company}`}</p>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default TestimonialsList;
