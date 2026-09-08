import { base } from "viem/chains";
import { createPublicClient, http } from "viem";
import { config } from "./config";

/** Public read-only Base client. The demo build has no wallet/signing client. */
export const publicClient = createPublicClient({
  chain: base,
  transport: http(config.rpcUrl, { timeout: 8000 }),
});
