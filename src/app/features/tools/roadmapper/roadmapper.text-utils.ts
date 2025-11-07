import { SplitTextInRowResult, StyleContext, Text } from './roadmapper.models';

export type TextMetrics = { width: number; height: number; ascent: number; descent: number };

export function measureTextCanvas(ctx: CanvasRenderingContext2D, text: string, font: string): TextMetrics {
  if (!ctx) throw new Error('2D canvas context not supported');
  ctx.font = `${font}`;
  const metrics = ctx.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent;
  const descent = metrics.actualBoundingBoxDescent;
  return { width: metrics.width, height: ascent + descent, ascent, descent };
}

export function parseCssValueToPx(cssValue: string, ctx: StyleContext): number {
  const value = parseFloat(cssValue);
  const unit = cssValue.replace(/[0-9.\-]/g, '').trim();
  switch (unit) {
    case 'px':
    case '':
      return value;
    case 'rem':
      return value * ctx.remFontSize;
    case 'em':
      return value * ctx.emFontSize;
    default:
      throw new Error(`Unsupported unit: ${unit}`);
  }
}

export function sumCssValuesToPx(ctx: StyleContext, ...cssValues: string[]): number {
  return cssValues.reduce((sum, v) => sum + parseCssValueToPx(v, ctx), 0);
}

export function splitsText(text: string): string[] { return text.split(/\s+/); }

export function splitsTextInRows(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: CSSStyleDeclaration,
  maxWidth: number
): SplitTextInRowResult {
  const splitTextInRows: SplitTextInRowResult = new SplitTextInRowResult();
  splitTextInRows.style = style;
  const fragments = splitsText(text);
  let rowId = 0;
  splitTextInRows.rows[rowId] = new Text();
  for (const fragment of fragments) {
    const measure = splitTextInRows.rows[rowId].text + ' ' + fragment;
    const textSize = measureTextCanvas(ctx, measure, style.font);
    if (textSize.width > maxWidth) {
      rowId++;
      splitTextInRows.rows[rowId] = Text.new(fragment, measureTextCanvas(ctx, fragment, style.font));
    } else {
      splitTextInRows.rows[rowId].text = splitTextInRows.rows[rowId].text + ' ' + fragment;
      splitTextInRows.rows[rowId].measure = measureTextCanvas(ctx, splitTextInRows.rows[rowId].text, style.font);
    }
  }
  return splitTextInRows;
}

export function removeLastWord(text: string): string {
  const parts = text.trim().split(/\s+/);
  parts.pop();
  return parts.join(' ');
}

export function ellipsizeRows(
  ctx2d: CanvasRenderingContext2D,
  splitRowsResult: SplitTextInRowResult,
  maxHeight: number,
  ctx: StyleContext
): Text[] {
  if (splitRowsResult.style === undefined || splitRowsResult.style.font === undefined) {
    throw new Error('style not defined (CSSStyleDeclaration)');
  }
  const rows: Text[] = [];
  let height = 0;
  for (const row of splitRowsResult.rows) {
    height += parseCssValueToPx(splitRowsResult.style.lineHeight, ctx);
    if (height > maxHeight) {
      const lastId = rows.length - 1;
      rows[lastId].text = removeLastWord(rows[lastId].text) + ' ...';
      rows[lastId].measure = measureTextCanvas(ctx2d, rows[lastId].text, splitRowsResult.style.font);
      return rows;
    }
    rows.push(row);
  }
  return rows;
}

export function getTextPosition(ctx: StyleContext) {
  if (!ctx.styles) throw new Error('style not defined');
  return {
    horizontal: {
      align: ctx.styles.textAlign,
      indent: parseCssValueToPx(ctx.styles.textIndent, ctx),
      paddingLeft: parseCssValueToPx(ctx.styles.paddingLeft, ctx),
      paddingRight: parseCssValueToPx(ctx.styles.paddingRight, ctx)
    },
    vertical: {
      align: ctx.styles.verticalAlign,
      lineHeight: parseCssValueToPx(ctx.styles.lineHeight, ctx),
      paddingTop: parseCssValueToPx(ctx.styles.paddingTop, ctx),
      paddingBottom: parseCssValueToPx(ctx.styles.paddingBottom, ctx)
    }
  };
}
