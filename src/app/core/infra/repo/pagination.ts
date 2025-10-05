export interface Links {
  next: string | null;
}

export interface Filters {
  path: string;
}

export interface Pagination {
  limit: number;
  returned: number;
  has_next: boolean;
  next_cursor: string | null;
  links: Links;
  filters: Filters;
  sort: string[];
}

export interface PaginationResponse<T> {
  data: T[];
  pagination: Pagination;
}
