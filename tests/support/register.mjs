// Fait tourner le vrai code de lib/db/ dans Node : expo-sqlite sur node:sqlite (base en mémoire),
// react-native réduit à Platform, et imports sans extension résolus vers .ts.
import { register } from "node:module";

register("./hooks.mjs", import.meta.url);
