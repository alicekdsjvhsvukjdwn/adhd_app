const SIMULES = {
  "expo-sqlite": new URL("./expo-sqlite.mjs", import.meta.url).href,
  "react-native": new URL("./react-native.mjs", import.meta.url).href,
};

export async function resolve(specifier, contexte, suivant) {
  if (SIMULES[specifier]) return { url: SIMULES[specifier], shortCircuit: true };
  try {
    return await suivant(specifier, contexte);
  } catch (e) {
    // Le code de l'appli importe sans extension (Metro) : fichier .ts, ou dossier avec index.ts.
    if (/^\.\.?\//.test(specifier) && !/\.\w+$/.test(specifier)) {
      if (e.code === "ERR_MODULE_NOT_FOUND") return suivant(specifier + ".ts", contexte);
      if (e.code === "ERR_UNSUPPORTED_DIR_IMPORT") return suivant(specifier + "/index.ts", contexte);
    }
    throw e;
  }
}
