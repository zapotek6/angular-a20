// Board models for v1
// Coordinate system: (0,0) at top-left in board units. Positive X to the right, positive Y down.
// Logical units: at 100% zoom, 1 unit = 10 px.

export type CardShape = 'rect' | 'rounded-rect' | 'circle' | 'triangle' | 'polyline';

export type ConnectionPointShape = 'circle' | 'rect';

// Normalized coordinates relative to the card's rectangle (0,0 top-left; 1,1 bottom-right)
export interface ConnectionPoint {
  id: string;
  relX: number; // 0..1
  relY: number; // 0..1
  shape?: ConnectionPointShape; // visual indicator; default 'circle'
  hotRadius?: number; // activation radius in board units (bigger than the visible indicator)
}

export interface CardModel {
  id: string;
  boardId: string;
  // Top-left corner in board units
  x: number;
  y: number;
  width: number; // board units
  height: number; // board units
  title: string;
  body: string;
  color: string; // CSS color
  shape: CardShape; // v1 uses only 'rect'
  connectionPoints?: ConnectionPoint[]; // if missing, defaults to 4 mid-side points for 'rect'
}

export interface ViewportState {
  zoom: number; // scale factor where 1.0 = 100% and 1 unit = 10 px
  offsetX: number; // SVG user units (viewBox units) for panning
  offsetY: number; // SVG user units (viewBox units) for panning
}

export interface BoardState {
  boardId: string;
  cards: CardModel[];
  selectedCardIds: string[];
  selectedLinkIds: string[]; // links selection (mutually exclusive with cards)
  viewport: ViewportState;
  links: LinkModel[];
}


export const DEFAULT_BOARD_ID = 'default-board';
export const UNIT_TO_PX_AT_100 = 10; // px per unit at zoom = 1
export const MIN_CARD_SIZE_UNITS = 10; // 100px at 100% zoom

export type LinkDashStyle = 'solid' | 'dashed' | 'dotted';
export type LinkArrowStyle = 'none' | 'open' | 'filled';

export interface LinkStyle {
  color: string; // stroke color
  width: number; // stroke width in board units
  dash?: LinkDashStyle;
  arrowHead?: LinkArrowStyle;
  arrowTail?: LinkArrowStyle;
}

export interface LinkLabel {
  text: string;
  t?: number; // position along the curve 0..1, default 0.5
}

export type LinkRouting = 'bezier'; // future: 'straight' | 'orthogonal'

export interface LinkModel {
  id: string;
  boardId: string;
  sourceCardId: string;
  sourcePointId: string;
  targetCardId: string;
  targetPointId: string;
  style: LinkStyle;
  label?: LinkLabel;
  routing: LinkRouting;
}
