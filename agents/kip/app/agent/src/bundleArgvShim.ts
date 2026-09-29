// Imported first by bundleEntry.ts. In a single-file bundle every module shares one import.meta.url, so the
// scaffold's "am I the entrypoint?" checks in dualMain.ts and mcpMain.ts would all be true and each would start
// its own server. Pointing argv[1] elsewhere makes those checks false; bundleEntry.ts starts the one server itself.
process.argv[1] = "afterhours-kip-bundle";
export {};
