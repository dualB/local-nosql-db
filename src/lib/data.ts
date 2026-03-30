import * as fs from "fs";



/**
 * Interface pour les tables
 */
export interface ITable<T = any> {
  toObject(): T[];
}

/**
 * Dictionnaire de tables
 */
export const allTables: Record<string, ITable> = {};

/**
 * Données brutes chargées depuis le disque
 */
export const fullDatas: Record<string, any[]> = {};

/**
 * Sérialisation complète de la DB
 */
function formatForFile(): string {
  const dbContent: Record<string, unknown> = {};

  Object.keys(allTables).forEach((key) => {
    dbContent[key] = allTables[key].toObject();
  });

  return JSON.stringify(dbContent, null, 2);
}

/**
 * Fonctions redéfinies dynamiquement après connect()
 */
export let saveDb: () => Promise<void> = async () => {
  console.warn(
    "Aucune sauvegarde effectuée. La base de donnée ne sera qu'en mémoire."
  );
};

let loadDb: () => void = () => {
  console.warn("La base de donnée ne sera qu'en mémoire.");
};

/**
 * Connexion à une DB fichier
 */
export function connect(uri: string, startFromScratch = false): void {
  loadDb = () => {
    try {
      if (!fs.existsSync(uri)) return;

      const data = fs.readFileSync(uri, { encoding: "utf8" });
      const real: Record<string, {id:string}[]> = JSON.parse(data);

      Object.keys(real).forEach((key) => {
        fullDatas[key] = real[key];
      });
    } catch (err) {
      console.error(err);
    }
  };

  saveDb = async () => {
    try {
      fs.writeFileSync(uri, formatForFile());
    } catch (err) {
      console.error(err);
    }
  };

  if (!startFromScratch) {
    loadDb();
  }
}

export default { connect };