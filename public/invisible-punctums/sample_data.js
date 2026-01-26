
// SAMPLE DATA FOR "SEE SAMPLE" FEATURE
// Extracted from user templates and synthesized for variety.

const SAMPLE_DATA_LIBRARY = [
    // SAMPLE 1: JOY (Children/Yellow Shirt) - HIGH ALIGNMENT
    {
        analytics: {
            gemini: {
                aggregate: {
                    dominant_emotion: "Joy",
                    keywords: ["Playful", "Joyful", "Inspired", "Enthusiastic", "Nostalgic", "Radiant", "Carefree"]
                }
            },
            advanced: {
                ai_data: {
                    visual_description: "A group of children, one in a vivid yellow shirt, laughing together under warm natural light. The composition is energetic and candid.",
                    dominant_emotion: "Joyful",
                    keywords: ["Playful", "Happy", "Excited", "Affectionate"],
                    summary: "The image depicts a group of children, one wearing a yellow shirt, engaged in an activity. Soft, natural lighting illuminates the scene, creating a warm and inviting atmosphere."
                },
                human_data: {
                    human_response_analysis: "Human responses overwhelmingly center around feelings of joy, excitement, and inspiration, indicating a broadly positive and energized state. There's a slight variance in phrasing reflecting individual expression.",
                    variability_score: 25
                },
                comparison: {
                    trainability_score: 85,
                    trainability_label: "Easily Trainable",
                    trainability_analysis: "The AI's initial assessment of 'Joyful' accurately reflects the core sentiment expressed by the human comments. The presence of 'excited' and 'inspired' reinforces this alignment, suggesting a strong capacity for emotional recognition."
                },
                synthesis: {
                    agreement_level: "High"
                }
            }
        },
        raw_comments: [
            "This makes me smile instantly!",
            "Pure joy captured in a frame.",
            "Reminder of simple childhood happiness.",
            "Love the energy and the yellow shirt!",
            "So candid and full of life.",
            "Infectious laughter, really great shot.",
            "Feels like a warm summer day.",
            "Absolute happiness.",
            "The lighting is just perfect for this mood.",
            "Makes me feel young again."
        ]
    },

    // SAMPLE 2: MELANCHOLY (Forest/Dark Figure) - MODERATE/LOW ALIGNMENT
    {
        analytics: {
            gemini: {
                aggregate: {
                    dominant_emotion: "Melancholy",
                    keywords: ["Curiosity", "Unease", "Admiration", "Mystery", "Haunting", "Beautiful", "Dark"]
                }
            },
            advanced: {
                ai_data: {
                    visual_description: "A solitary figure in a dark, forest-like setting, bathed in soft, diffused light. Shadows of leaves cast intricate patterns on the subject.",
                    dominant_emotion: "Calm",
                    keywords: ["Serene", "Quiet", "Vulnerable", "Contemplative", "Subdued"],
                    summary: "The image features a solitary figure in a dark setting, bathed in soft, diffused light. The subject's posture and lighting create a sense of quiet contemplation and vulnerability."
                },
                human_data: {
                    human_response_analysis: "Human responses showcase a wide range of reactions, from profound admiration to a sense of unease. This highlights a fragmented emotional landscape where beauty and fear coexist.",
                    variability_score: 70
                },
                comparison: {
                    trainability_score: 45,
                    trainability_label: "Moderately Trainable",
                    trainability_analysis: "The AI's identification of 'Calm' contrasts with the human comments expressing feelings of 'unease' and 'melancholy', illustrating a divergence in emotional perception. The AI misses the darker undertones."
                },
                synthesis: {
                    agreement_level: "Low"
                }
            }
        },
        raw_comments: [
            "makes me feel very uneasy tbh",
            "the photographer knows how to capture this energy",
            "she feels like a goddess of the forest",
            "ghost in the forest feels",
            "gosh i love this shadows of the leaves on her",
            "who is the photographer! love this!",
            "It’s beautiful but also kinda scary.",
            "Very moody and dark.",
            "I feel a deep sense of loneliness here.",
            "Is she hiding or waiting? Mysterious."
        ]
    },

    // SAMPLE 3: AWE (Synthesized) - MODERATE ALIGNMENT
    {
        analytics: {
            gemini: {
                aggregate: {
                    dominant_emotion: "Awe",
                    keywords: ["Grandeur", "Insignificance", "Peace", "Fear", "Sublime", "Eternal", "Humbled"]
                }
            },
            advanced: {
                ai_data: {
                    visual_description: "A vast mountain range under a starry night sky. A tiny silhouette of a person looks up at the galaxy. The scale contrast is immense.",
                    dominant_emotion: "Peaceful",
                    keywords: ["Majestic", "Quiet", "Dark", "Expansive", "Cold"],
                    summary: "A tiny human silhouette stands before a massive, star-filled sky over mountains. The visual scale emphasizes the vastness of nature compared to the individual."
                },
                human_data: {
                    human_response_analysis: "Humans express a mix of existential dread and profound beauty. While some feel peaceful, others feel overwhelmed by the scale, creating a complex emotional texture.",
                    variability_score: 55
                },
                comparison: {
                    trainability_score: 60,
                    trainability_label: "Moderately Trainable",
                    trainability_analysis: "AI correctly identifies 'Peaceful' and 'Majestic' notes but misses the existential 'overwhelmed' feeling reported by humans. Ideally, it should detect the nuance of 'sublime terror'.",

                },
                synthesis: {
                    agreement_level: "Moderate"
                }
            }
        },
        raw_comments: [
            "I feel so small looking at this.",
            "Absolutely breathtaking view.",
            "Terrifyingly beautiful.",
            "Make me think about the universe.",
            "Silence. Just silence.",
            "I want to be there right now.",
            "The stars look like diamonds.",
            "Is this real or edited? Too good.",
            "Existential crisis incoming...",
            "Majestic."
        ]
    }
];
