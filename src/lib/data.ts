import * as fs from "fs";
import * as path from 'path'
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
//const allTablesResolver = Promise.withResolvers<Record<string, ITable>>()

//export const allTablesPromise = allTablesResolver.promise

/**
 * Données brutes chargées depuis le disque
 */
//export const fullDatas: Record<string, any[]> = {};
const fullDatasResolver = Promise.withResolvers<Record<string, any[]>>()
export const fullDatasPromise = fullDatasResolver.promise

const uriResolver = Promise.withResolvers<string>()



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

function once<T extends (...args: any[]) => any>(fn: T, message: string): T {
  let called = false

  return function (this: any, ...args: any[]) {
    if (called) {
      console.warn('LOCAL-NOSQL-DB :',message)
      return
    }
    called = true
    return fn.apply(this, args)
  } as T
}



/**
 * Connexion à une DB fichier
 */
function realConnect(uri: string, options:{repartirANeuf?: boolean,log?:boolean}={repartirANeuf:false,log:true}): void {
  const logger = options?.log? console.log :()=>{}
  uri = path.resolve(uri)
  logger(`LOCAL-NOSQL-DB : Tentative de chargement du fichier "${uri}"...`)
  uriResolver.resolve(uri)

  if (!fs.existsSync(uri)) {
    console.warn(`LOCAL-NOSQL-DB : Le fichier "${uri}" n'existe pas. Aucune donnée ne sera chargée pour l'instant.`)
    fullDatasResolver.resolve({})

    return;
  }
  else {
    if (options?.repartirANeuf) {
      logger(`LOCAL-NOSQL-DB : Le fichier "${uri}" existe mais le contenu sera ignoré pour repartir à neuf.`)
       fullDatasResolver.resolve({})
    }
    else {
      try {
        const data = fs.readFileSync(uri, { encoding: "utf8" });
        const real: Record<string, { id: string }[]> = JSON.parse(data);
        logger(`LOCAL-NOSQL-DB : Chargement du fichier "${uri}" réussi.`)
        fullDatasResolver.resolve(real)
      }
      catch (e) {
        console.warn(`LOCAL-NOSQL-DB : Échec du chargement du fichier "${uri}". Aucune donnée ne sera chargée pour l'instant.`)
        fullDatasResolver.resolve({})
      }
    }
  }

}

export async function saveDb(): Promise<boolean> {

  const uri = await uriResolver.promise

  try {
    fs.writeFileSync(uri, formatForFile());
    return true
  } catch (err) {
    console.error(err);
    return false
  }
}

export const connect = once(realConnect,`La fonction "connect" ne peut être appelée plusieurs fois. Cet appel est ignoré.`)

