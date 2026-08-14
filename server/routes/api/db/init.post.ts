import { defineHandler } from "nitro";
import { initializeDatabase } from "../../../db/init";

export default defineHandler(async () => {
  return await initializeDatabase();
});
