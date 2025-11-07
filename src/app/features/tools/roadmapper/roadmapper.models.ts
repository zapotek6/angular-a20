// Types and interfaces extracted from roadmapper.ts to keep the component lean

export type Point = { x: number; y: number };
export type Size = { w: number; h: number };

export class TextMeasure {
  width: number = 0;
  height: number = 0;
  ascent: number = 0;
  descent: number = 0;
}

export enum TextVert { TOP, MIDDLE, BOTTOM }
export enum TextHoriz { LEFT, CENTER, RIGHT }

export class Text {
  text: string = '';
  measure: TextMeasure = new TextMeasure();

  static new(text: string, measure: TextMeasure): Text {
    const t = new Text();
    t.text = text;
    t.measure = measure;
    return t;
  }

  height(): number { return this.measure.height; }
  width(): number { return this.measure.width; }
}

export class SplitTextInRowResult {
  rows: Text[] = [];
  style?: CSSStyleDeclaration;

  height(): number {
    return this.rows.reduce((acc, row) => acc + row.height(), 0);
  }

  maxWidth(): number {
    return this.rows.reduce((max, row) => Math.max(max, row.width()), 0);
  }
}

export interface Pill {
  visible: boolean;
  text: string;
  class: string;
}

export interface NodeModel {
  nodeClass: string;
  id: string;
  projectId: string,
  key: string;
  title: string;
  pill?: Pill;
  meta: string;
  ticket: string;
  x: number;
  y: number;
  w: number;
  h: number;
  collapsed: boolean;
}

export interface LinkModel {
  id: string;
  from: string;
  to: string;
}

export interface DragState {
  model: NodeModel;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  el: SVGGElement;
}

export type StyleContext = {
  styles?: CSSStyleDeclaration,
  remFontSize: number,
  emFontSize: number
}
