export type TheaterId = "beacon" | "siff-uptown" | "siff-downtown" | "siff-center" | "nwff";

export interface Theater {
  name: string;
  url: string;
  id: TheaterId;
}
