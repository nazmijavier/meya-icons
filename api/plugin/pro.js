// GET /api/plugin/pro?style=sharp&icon=general/home: /api/pro for the Figma plugin, signed in with its token.
import { cors, OPTIONS } from "../_lib/plugin.js";
import { GET as pro } from "../pro.js";

export { OPTIONS };

export async function GET(request) {
  return cors(await pro(request));
}
