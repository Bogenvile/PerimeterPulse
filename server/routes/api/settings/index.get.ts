import { defineHandler } from "nitro";
import { getAllSettings } from "../../../db/mysql";
import { requireAdminAuth } from "../../../lib/auth";

export default defineHandler(async (event) => {
  await requireAdminAuth(event);
  return getAllSettings();
});