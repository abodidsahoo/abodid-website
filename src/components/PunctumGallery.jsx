import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const PunctumGallery = ({ images, onSelect }) => {
    return (
        <div className="w-full max-w-[1600px] mx-auto p-4 md:p-8 pt-24 md:pt-32">

            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-thin tracking-tight mb-4 text-white">Subject Selection</h2>
                <p className="text-stone-500 font-light max-w-xl mx-auto">
                    Select an image from the archives to begin the analysis protocol.
                    The system requires your emotional projection to establish a baseline.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {images.map((img, i) => (
                    <motion.div
                        key={img.id || i}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.05 }}
                        whileHover={{ scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onSelect(img)}
                        className="aspect-[3/4] bg-stone-900 rounded-sm overflow-hidden cursor-pointer relative group border border-white/5 shadow-2xl"
                    >
                        <img
                            src={img.url}
                            alt={img.title || "Subject"}
                            loading="lazy"
                            className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all duration-500 grayscale group-hover:grayscale-0"
                        />

                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                            <span className="text-white text-xs font-mono tracking-widest uppercase">
                                ID-{String(img.id).substring(0, 8)}
                            </span>
                        </div>
                    </motion.div>
                ))}
            </div>

            {images.length === 0 && (
                <div className="text-center py-20 text-stone-600 font-mono text-sm">
                    Scanning archives...
                </div>
            )}
        </div>
    );
};

export default PunctumGallery;
