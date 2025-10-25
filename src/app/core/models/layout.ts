export class Position {
  x: number = 0;
  y: number = 0;
}

export class Node {
  id: string = "";
  pos: Position = new Position();
  collapsed: boolean = false;
  hidden: boolean = false;
}

export class EmbeddedLayout {
  id: string = "";
  pan: Position = new Position();
  collapsed: boolean = false;
  hidden: boolean = false;
}

export class Layout {
  name: string = "";
  description: string = "";
  nodes: Node[] = [];
  embedded_layouts: EmbeddedLayout[] = [];

  id: string = "";
  version: number = 0;
  tenant_id: string = "";
  location: string = "";
  resource_type: string = "";
  created_at: string = "";
  updated_at: string = "";
  created_by: string = "";
  updated_by: string = "";
}
