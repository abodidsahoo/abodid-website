// Theme the actual paint declarations used by older pages as well as tokenised
// ones. With no active site theme, the browser uses the original declaration.
const foregroundProperties = new Set([
  "color", "text-decoration-color", "caret-color", "accent-color", "outline-color", "-webkit-text-fill-color",
]);
const backgroundProperties = new Set(["background", "background-color"]);
const singleColour = /^(?:#[\da-f]{3,8}|(?:white|black|red|blue|grey|gray|yellow|purple|green|orange|pink|navy|ivory)|(?:rgb|hsl|oklch|oklab|var)\((?:[^()]|\([^()]*\))*\))$/i;
const brandStyles = /\/styles\/brands\.css(?:$|\?)/;
const borderColour = /^border(?:-[\w-]+)?-color$/;

export default {
  postcssPlugin: "site-theme-paint",
  Once(root) {
    const file = root.source?.input.file || "";
    if (file.includes("/node_modules/") || brandStyles.test(file)) return;
    root.walkDecls((declaration) => {
      const property = declaration.prop.toLowerCase();
      const value = declaration.value.trim();
      const foreground = foregroundProperties.has(property) || borderColour.test(property);
      if (!foreground && !backgroundProperties.has(property)) return;
      if (/^var\(--site-palette-/.test(value)) return;
      if (!foreground && (
        !singleColour.test(value)
        || /(?:transparent|overlay|url\(|gradient\(|\s\/\s|^rgba\(|^hsla\()/i.test(value)
        || /^#(?:[\da-f]{4}|[\da-f]{8})$/i.test(value)
      )) return;
      if (foreground && /^(?:inherit|initial|unset|revert(?:-layer)?|transparent|currentcolor)$/i.test(value)) return;
      // Keep the raw value as a fallback for browsers without custom properties.
      const role = foreground ? "ink" : "paper";
      declaration.cloneAfter({ value: `var(--site-palette-${role}, ${value})` });
    });
  },
};
