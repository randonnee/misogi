export type RunMode = "mock" | "prod" | "update_mocks";

export const RUN_MODE: RunMode = (process.env.RUN_MODE as RunMode) || "mock";
