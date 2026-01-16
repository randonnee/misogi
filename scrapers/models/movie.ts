export interface Movie {
  title: string;
  url?: string;
  directors?: string[];
  actors?: string[];
  runtime?: number; // minutes
  description?: string;
  releaseYear?: number;
  letterboxdUrl?: string;
}
