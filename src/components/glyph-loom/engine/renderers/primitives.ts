import type { ModuleInstance } from "../../types";

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(Math.abs(width) / 2, Math.abs(height) / 2, Math.max(0, radius));
  context.beginPath();
  context.roundRect(x, y, width, height, r);
}

export function drawCanvasPrimitive(
  context: CanvasRenderingContext2D,
  module: ModuleInstance,
): void {
  const x = -module.width / 2;
  const y = -module.height / 2;
  context.fillStyle = module.fill;
  context.strokeStyle = module.stroke;
  context.lineWidth = module.strokeWidth;

  switch (module.primitive) {
    case "circle":
    case "dot":
      context.beginPath();
      context.arc(0, 0, Math.min(module.width, module.height) / (module.primitive === "dot" ? 3 : 2), 0, Math.PI * 2);
      context.fill();
      break;
    case "cross": {
      const thickness = Math.min(module.width, module.height) * 0.34;
      context.fillRect(-module.width / 2, -thickness / 2, module.width, thickness);
      context.fillRect(-thickness / 2, -module.height / 2, thickness, module.height);
      break;
    }
    case "lines": {
      const count = Math.max(2, module.lineCount);
      context.beginPath();
      for (let index = 0; index < count; index += 1) {
        const lineY = -module.height / 2 + (module.height / Math.max(1, count - 1)) * index;
        context.moveTo(-module.width / 2, lineY);
        context.lineTo(module.width / 2, lineY);
      }
      context.stroke();
      break;
    }
    case "checker":
      {
        const frequency = Math.max(2, module.lineCount);
        const cellWidth = module.width / frequency;
        const cellHeight = module.height / frequency;
        for (let row = 0; row < frequency; row += 1) {
          for (let column = 0; column < frequency; column += 1) {
            if ((row + column) % 2 === 0) {
              context.fillRect(x + column * cellWidth, y + row * cellHeight, cellWidth, cellHeight);
            }
          }
        }
      }
      break;
    case "bar":
    case "woven":
    case "square":
    default:
      roundedRect(context, x, y, module.width, module.height, module.cornerRadius);
      context.fill();
  }
}

function attrs(module: ModuleInstance): string {
  return `fill="${module.fill}" stroke="${module.stroke}" stroke-width="${module.strokeWidth}"`;
}

export function svgPrimitive(module: ModuleInstance): string {
  const x = -module.width / 2;
  const y = -module.height / 2;
  switch (module.primitive) {
    case "circle":
    case "dot":
      return `<circle cx="0" cy="0" r="${Math.min(module.width, module.height) / (module.primitive === "dot" ? 3 : 2)}" ${attrs(module)}/>`;
    case "cross": {
      const thickness = Math.min(module.width, module.height) * 0.34;
      return `<path d="M ${x} ${-thickness / 2} h ${module.width} v ${thickness} h ${-module.width} Z M ${-thickness / 2} ${y} h ${thickness} v ${module.height} h ${-thickness} Z" ${attrs(module)}/>`;
    }
    case "lines": {
      const count = Math.max(2, module.lineCount);
      const paths = Array.from({ length: count }, (_, index) => {
        const lineY = -module.height / 2 + (module.height / Math.max(1, count - 1)) * index;
        return `M ${-module.width / 2} ${lineY} H ${module.width / 2}`;
      }).join(" ");
      return `<path d="${paths}" fill="none" stroke="${module.stroke}" stroke-width="${module.strokeWidth}"/>`;
    }
    case "checker":
      {
        const frequency = Math.max(2, module.lineCount);
        const cellWidth = module.width / frequency;
        const cellHeight = module.height / frequency;
        const cells: string[] = [];
        for (let row = 0; row < frequency; row += 1) {
          for (let column = 0; column < frequency; column += 1) {
            if ((row + column) % 2 === 0) {
              cells.push(`<rect x="${x + column * cellWidth}" y="${y + row * cellHeight}" width="${cellWidth}" height="${cellHeight}" ${attrs(module)}/>`);
            }
          }
        }
        return cells.join("");
      }
    default:
      return `<rect x="${x}" y="${y}" width="${module.width}" height="${module.height}" rx="${module.cornerRadius}" ${attrs(module)}/>`;
  }
}
