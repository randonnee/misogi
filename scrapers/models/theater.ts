export type TheaterId = "beacon" | "siff-uptown" | "siff-downtown" | "siff-center" | "nwff" | "grand-illusion" | "central-cinema";

export interface Theater {
  name: string;
  url: string;
  id: TheaterId;
  about: string;
  address: string;
  addressLink?: string;
}
