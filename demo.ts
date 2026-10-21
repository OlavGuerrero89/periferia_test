import { processRequest } from "./src/application/process-request";
async function main() { const result = await processRequest(); console.log(JSON.stringify(result)); if (result.status === "pending_prd") console.log("Scaffold OK; demo funcional pendiente del PRD"); }
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
