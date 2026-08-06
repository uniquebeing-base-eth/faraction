import { createServerFn } from "@tanstack/react-start";

export const getFactsQuote = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchFactsQuote } = await import("./facts-price.server");
  return fetchFactsQuote();
});
