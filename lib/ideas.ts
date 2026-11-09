export const ideaCategories = [
  "trading", "business", "content", "ai_project", "personal", "other",
] as const;
export const ideaStatuses = ["unprocessed", "in_progress", "completed"] as const;
export const ideaPriorities = ["high", "normal", "low"] as const;
export const ideaSorts = ["newest", "oldest", "priority", "updated"] as const;

export const IDEA_TITLE_LIMIT = 160;
export const IDEA_CONTENT_LIMIT = 20000;

export interface IdeaFields {
  title: string;
  content: string;
  category: (typeof ideaCategories)[number];
  status: (typeof ideaStatuses)[number];
  priority: (typeof ideaPriorities)[number];
}

export interface IdeaEntry extends IdeaFields {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface IdeaFilters {
  query: string;
  category: IdeaFields["category"] | "";
  status: IdeaFields["status"] | "";
  priority: IdeaFields["priority"] | "";
  sort: (typeof ideaSorts)[number];
}

export const defaultIdeaFilters: IdeaFilters = {
  query: "",
  category: "",
  status: "",
  priority: "",
  sort: "newest",
};

export function selectIdeas(ideas: IdeaEntry[], filters: IdeaFilters) {
  const query = filters.query.trim().toLowerCase();
  return ideas
    .filter((idea) =>
      (!query || idea.title.toLowerCase().includes(query) || idea.content.toLowerCase().includes(query)) &&
      (!filters.category || filters.category === idea.category) &&
      (!filters.status || filters.status === idea.status) &&
      (!filters.priority || filters.priority === idea.priority),
    )
    .sort((a, b) => {
      const newestFirst = b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
      switch (filters.sort) {
        case "oldest":
          return -newestFirst;
        case "priority":
          return ideaPriorities.indexOf(a.priority) - ideaPriorities.indexOf(b.priority) || newestFirst;
        case "updated":
          return b.updatedAt.localeCompare(a.updatedAt) || newestFirst;
        default:
          return newestFirst;
      }
    });
}
