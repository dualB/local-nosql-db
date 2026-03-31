import * as fs from "fs";
import { AnyObject, Schema } from "./schema";
import { TableModel } from "./modele";

/**
 * Interface pour les tables
 */
export interface ITable<T = any> {
  toObject(): T[];
}

export interface Database{
  createTable<T extends AnyObject>(
    name: string,
    schema: Schema<T>
  ): TableModel<T>
}

/**
 * Dictionnaire de tables
 */

/**
 * Données brutes chargées depuis le disque
 */



/**
 * Fonctions redéfinies dynamiquement après connect()
 */


/**
 * Connexion à une DB fichier
 */
export async function connect(uri: string, startFromScratch = false): Promise<Database> {

  const fullDatas: Record<string, any[]> = {};
  const allTables: Record<string, ITable> = {};
  let saveDb: () => Promise<void> = async () => {
    console.warn(
      "Aucune sauvegarde effectuée. La base de donnée ne sera qu'en mémoire."
    );
  };

  let loadDb: () => void = () => {
    console.warn("La base de donnée ne sera qu'en mémoire.");
  };

  loadDb = () => {
    try {
      if (!fs.existsSync(uri)) {
        console.warn(`Le fichier ${uri} est inexistant...`)
        return;
      }

      const data = fs.readFileSync(uri, { encoding: "utf8" });
      const real: Record<string, { id: string }[]> = JSON.parse(data);

      Object.keys(real).forEach((key) => {
        fullDatas[key] = real[key];
      });
      console.log(`Le fichier ${uri} a été chargé.`)
      saveDb = async () => {
        try {
          fs.writeFileSync(uri, formatForFile());
        } catch (err) {
          console.error(err);
        }
      };

    } catch (err) {
      console.error(err);
    }
  };

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



  if (!startFromScratch) {
    loadDb();
  }
  return Promise.resolve()
}

export default { connect };