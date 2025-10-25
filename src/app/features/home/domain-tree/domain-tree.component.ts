import {ChangeDetectionStrategy, Component, OnDestroy, OnInit, ChangeDetectorRef} from '@angular/core';
import {TreeModule, TreeNodeSelectEvent} from 'primeng/tree';
import {TreeNode} from 'primeng/api';
import {WorkspaceEvent, WorkspaceService, WorkspaceState} from '../../../core/workspace/workspace.service';
import {BroadcasterService} from '../../../core/brodacaster.service';
import {Logger, LogSeverity} from '../../../core/logger/logger';
import {LoggerService} from '../../../core/logger/logger.service';
import {CommonModule} from '@angular/common';
import {Subscription, forkJoin} from 'rxjs';
import {Domain, EntityKind} from '../../../core/models/domain';
import {Person} from '../../../core/models/person';
import {Project} from '../../../core/models/project';
import {ResourceType} from '../../../core/models/types';

@Component({
  selector: 'app-domain-tree',
  standalone: true,
  imports: [CommonModule, TreeModule],
  templateUrl: './domain-tree.component.html',
  styleUrl: './domain-tree.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DomainTreeComponent implements OnInit, OnDestroy {
  nodes: TreeNode[] = [];
  loading = false;

  private bcast: BroadcasterService;
  private logger: Logger;
  private sub?: Subscription;
  protected selectedNode?: TreeNode;

  constructor(private readonly loggerService: LoggerService,
              private readonly workspace: WorkspaceService,
              private readonly cdr: ChangeDetectorRef) {
    this.logger = this.loggerService.createLocalLoggerInstance('DomainTreeComponent', LogSeverity.DEBUG);
    this.logger.enabled = false;
    this.bcast = new BroadcasterService(this.logger);
  }

  ngOnInit(): void {
    // Listen for workspace readiness
    this.bcast.onMessage((message) => {
      if (message?.type === WorkspaceState.Ready) {
        this.logger.debug('Workspace Ready received');
        this.loadDomains();
      }
    });

    // In case workspace is already ready before this component mounts
    if (this.workspace.isReady()) {
      this.loadDomains();
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe?.();
  }

  private loadDomains(): void {
    this.loading = true;
    this.sub?.unsubscribe?.();
    this.sub = forkJoin({
      domains: this.workspace.getDomains(),
      people: this.workspace.getPeople(),
      projects: this.workspace.getProjects(),
    }).subscribe({
      next: ({domains, people, projects}) => {
        this.nodes = this.buildTree(domains, people, projects);
        this.loading = false;
        this.setExpandedAll(this.nodes[0]);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.logger.err('loadDomains', 'Failed to load domains/people', err);
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  getDomainIcon(domain: Domain): string {
    switch (domain.kind) {
      case EntityKind.Tenant:
        return 'pi pi-globe';
      case EntityKind.Company:
        return 'pi pi-building';
      case EntityKind.Group:
        return 'pi pi-sitemap';
      case EntityKind.Unit:
        return 'pi pi-warehouse';
      case EntityKind.Department:
        return 'pi pi-users';
      case EntityKind.Container:
        return 'pi pi-folder';
      case EntityKind.Project:
        return 'pi pi-th-large';
      case EntityKind.Team:
        return 'pi pi-users';
      default:
        return 'pi pi-folder';
    }
  }

  private buildTree(domains: Domain[], people: Person[], projects: Project[]): TreeNode[] {
    const byLocation = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    const norm = (p: string): string => {
      let s = (p || '').trim();
      if (s.length === 0) return '/';
      if (!s.startsWith('/')) s = '/' + s;
      if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
      return s;
    };
    const parentPath = (p: string): string => {
      const s = norm(p);
      const idx = s.lastIndexOf('/');
      if (idx <= 0) return '';
      return s.substring(0, idx);
    };

    // Prepare all domain nodes indexed by location
    for (const d of domains) {
      const loc = norm(d.location);
      const node: TreeNode = {
        key: d.id,
        label: d.name,
        data: d,
        children: [],
        icon: this.getDomainIcon(d),
        type: d.resource_type.toLowerCase(),
      };
      byLocation.set(loc, node);
    }

    // Link domain children to parents using location path
    for (const d of domains) {
      const loc = norm(d.location);
      const node = byLocation.get(loc)!;
      const parentLoc = parentPath(loc);
      const parent = parentLoc ? byLocation.get(parentLoc) : undefined;
      if (parent) {
        (parent.children as TreeNode[]).push(node);
      } else {
        // Orphan or top-level: treat as root
        roots.push(node);
      }
    }

    // Attach people as leaf nodes under their location
    for (const p of people) {
      const loc = norm(p.location);
      const personNode: TreeNode = {
        key: `person:${p.id}`,
        label: p.display_name || `${p.name ?? ''} ${p.surname ?? ''}`.trim() || p.email,
        data: p,
        leaf: true,
        icon: 'pi pi-user',
        type: p.resource_type.toLowerCase(),
      };
      const parent = byLocation.get(loc);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(personNode);
      } else {
        // Orphan people: show at root so they are not lost
        roots.push(personNode);
      }
    }

    /*// Attach people as leaf nodes under their location
    for (const p of projects) {
      const loc = norm(p.location);
      const projectNode: TreeNode = {
        key: `projectNode:${p.id}`,
        label: p.name || '',
        data: p,
        leaf: true,
        icon: 'pi pi-briefcase',
        type: p.resource_type.toLowerCase(),
      };
      const parent = byLocation.get(loc);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(projectNode);
      } else {
        // Orphan people: show at root so they are not lost
        roots.push(projectNode);
      }
    }*/

    // Sort children alphabetically by label
    const sortRec = (ns: TreeNode[]) => {
      ns.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
      for (const n of ns) if (n.children && n.children.length) sortRec(n.children);
    };
    sortRec(roots);

    return roots;
  }

  expandedKeys: { [key: string]: boolean } = {};

  setExpandedAll(node: TreeNode) {

    this.expandNode(node);
    node.children?.forEach(node => {

      if (node.leaf === undefined || !node.leaf) {
        this.expandNode(node);

        (node.children as TreeNode[])
          .forEach(n => {
            this.setExpandedAll(n);
          });
      }
    });
  }

  expandNode(node: TreeNode) {
    if (node.key) {
      node.expanded = true;
      this.expandedKeys[node.key] = true;
    }
  }

  collapseNode(node: TreeNode) {
    if (node.key) {
      node.expanded = false;
      delete this.expandedKeys[node.key];
    }
  }

  nodeSelect(event: TreeNodeSelectEvent) {
    switch (event.node.type) {
      case ResourceType.Domain:
        if (event.node.data.kind.toLowerCase() == EntityKind.Project.toLowerCase()) {
          this.workspace.projectsRepo.read(this.workspace.tenant_id ?? "", event.node.data.detail_id).subscribe({
              next: (project) => {
                this.bcast.broadcast({type: WorkspaceEvent.ChangeProject, project: project})
              }
            }
          );
        }
        break;
      case ResourceType.People:
        break;
      case ResourceType.Project:
        this.bcast.broadcast({type: WorkspaceEvent.ChangeProject, project: event.node.data})
        break;
    }
  }
}
