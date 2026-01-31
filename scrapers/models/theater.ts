export type TheaterId = "beacon" | "siff-uptown" | "siff-downtown" | "siff-center" | "nwff" | "grand-illusion";

export interface Theater {
  name: string;
  url: string;
  id: TheaterId;
}
