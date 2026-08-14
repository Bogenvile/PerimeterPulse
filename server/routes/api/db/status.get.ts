import { defineHandler } from "nitro";
import { getDbStatus } from "../../../db/init";

export default defineHandler(async () => {
  return await getDbStatus();
});
