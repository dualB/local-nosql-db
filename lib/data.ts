import * as fs from "fs";

/**
 * Interface minimale pour les objets stockés
 */
export interface Persistable {
  save?: () => Promise<void>;
}

/**
 * Interface pour les tables (tu peux raffiner selon ton modèle réel)
 */
export interface Table<T = any> {
  toObject(): T[];
}

/**
 * Dictionnaire de tables
 */
export const allTables: Record<string, Table> = {};

/**
 * Données brutes chargées depuis le disque
 */
export const fullDatas: Record<string, Persistable[]> = {};

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
      const real: Record<string, Persistable[]> = JSON.parse(data);

      Object.keys(real).forEach((key) => {
        real[key].forEach((item) => {
          item.save = async () => {
            await saveDb();
          };
        });

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