import type { JSONContent } from "@tiptap/core";

export type Manuscript = {
    id: string;
    title: string;
    acts: Act[];
    draftScenes: Scene[];
};

export type Act = {
  id: string;
  title: string;
  synopsis?: string;
  chapters: Chapter[];
};

export type Chapter = {
  id: string;
  title: string;
  synopsis?: string;
  scenes: Scene[];
};

export type Scene = {
  id: string;
  title: string;
  content: JSONContent;
  synopsis?: string;
  pov?: string;
  characterIds: string[];
  location?: string;
  time?: string;
  aiAdditionalContext?: string
};
