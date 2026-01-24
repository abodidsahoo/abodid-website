import { useEffect, useRef } from "react";

declare global {
    interface Window {
        turnstile: any;
    }
}

interface Props {
    onToken: (token: string) => void;
    action?: string;
}

export default function Turnstile({ onToken, action = "auth" }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const widgetId = useRef<string | null>(null);

    useEffect(() => {
        if (document.getElementById("turnstile-script")) return;

        const script = document.createElement("script");
        script.id = "turnstile-script";
        script.src =
            "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.defer = true;
        document.body.appendChild(script);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            if (!window.turnstile || !ref.current) return;

            clearInterval(interval);

            // Clean up previous widget if exists
            if (widgetId.current) {
                try {
                    window.turnstile.remove(widgetId.current);
                } catch (e) {
                    // ignore
                }
            }

            const siteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY;

            if (!siteKey) {
                console.error("Missing PUBLIC_TURNSTILE_SITE_KEY");
                return;
            }

            widgetId.current = window.turnstile.render(ref.current, {
                sitekey: siteKey,
                action,
                callback: (token: string) => {
                    if (onToken) onToken(token);
                    window.dispatchEvent(new CustomEvent('turnstile-token', { detail: token }));
                },
                "expired-callback": () => {
                    if (onToken) onToken("");
                    window.dispatchEvent(new CustomEvent('turnstile-token', { detail: "" }));
                },
                "error-callback": () => {
                    if (onToken) onToken("");
                    window.dispatchEvent(new CustomEvent('turnstile-token', { detail: "" }));
                },
            });
        }, 100);

        return () => {
            // Don't auto-remove on unmount aggressively or it might flicker on re-renders,
            // but strictly speaking we should cleanup.
            // However, typical React strict mode mounts twice. 
            // The interval check handles the waiting.
            if (window.turnstile && widgetId.current) {
                try {
                    window.turnstile.remove(widgetId.current);
                    widgetId.current = null;
                } catch (e) { }
            }
        };
    }, [action, onToken]);
    // Added onToken to deps, though ideally it should be stable.
    // Ideally user passes a stable callback or we wrap it in ref.

    return <div ref={ref} style={{ minHeight: '65px', margin: '16px 0' }} />;
}
