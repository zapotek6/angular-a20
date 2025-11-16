import {NodeModel, StyleContext} from './roadmapper.models';
import {getEmInPxFromParent, getRemInPx} from './roadmapper.ui-utils';

const svgns = "http://www.w3.org/2000/svg";

export function createEl<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number> = {},
  viewEncapsulationScopeAttributeName: string
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(svgns, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));

  // add _ngcontent- to let the component's css apply to the elements added at runtime
  if (viewEncapsulationScopeAttributeName) el.setAttribute(viewEncapsulationScopeAttributeName, '');

  // if (parent) parent.appendChild(el);
  return el;
}

export function drawDefaultNode(n: NodeModel): void {
  const g = this.createEl("g", {class: "pmo", transform: `translate(${n.x},${n.y})`}, this.gNodes);
  this.nodeGroups.set(n.id, g);

  // Base rectangle
  this.createEl("rect", {class: `pmo ${n.nodeClass}`, width: n.w, height: n.h}, g);

  const ctx: StyleContext = {
  emFontSize: getEmInPxFromParent(g),
  remFontSize: getRemInPx(),
};

// Header: key + pill row
let o = {x: 0, y: 0};
let sz = {w: 60 - o.x, h: this.parseCssValueToPx('1.5rem', ctx)};
this.buildComponent(n.key, 'key', 'key', o, sz, ctx, g);

o = {x: 60, y: 0};
sz = {w: n.w - o.x, h: this.parseCssValueToPx('1.5rem', ctx)};
this.buildComponent('Default', 'pill delayed', 'pill delayed', o, sz, ctx, g);

// Title row
o = {x: 0, y: sz.h};
sz = {w: n.w - o.x, h: this.parseCssValueToPx('3rem', ctx)};
this.buildComponent(n.title, 'title', 'title', o, sz, ctx, g);

this.makeDraggable(g, n);
this.makeClickable(g, n);
this.setupCtxMenuForNode(g, n);
}

export function drawNode(n:NodeModel) {
  let node = drawDefaultNode(n)
}
