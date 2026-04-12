import { saveDb } from "./data";
import { createTableInDatabase, Table } from "./table";
import { AnyObject, buildTestPopulator, PopulateOption, Schema, SchemaDefinition } from "./schema";



/**
 * Type du constructeur retourné
 */
export type TableModel<T extends AnyObject> = {
  create(data: Partial<T>): Promise<T>;
  createMany(datas: Partial<T>[]): Promise<T[]>;
  findMany(query?: Partial<T>, options?: QueryOptions): Promise<T[]>;
  findOne(query: Partial<T>, options?: QueryOptions): Promise<T | undefined>;
  findOneById(id: string, options?: QueryOptions): Promise<T | undefined>;
  updateOneById(id: string, data: Partial<T>): Promise<void>;
  deleteOne(item: T | string): Promise<void>;
  deleteOneById(id: string): Promise<void>;
  deleteMany(query: Partial<T>): Promise<void>;
};

type QueryOptions = { populate?: PopulateOption }

/**
 * Factory principale
 */
export function createTable<T extends AnyObject>(
  name: string,
  schema: Schema<T>
): TableModel<T> {
  if (!name) throw new Error("Vous devez fournir un nom de table.");
  if (!schema) throw new Error("Vous devez fournir les champs de la table.");


  const tableP: Promise<Table<T>> = createTableInDatabase<T>(name, schema);

  function applyChanges(item: T, data: Partial<T>): T {
    const candidate = { ...item };

    Object.keys(data).forEach((key) => {
      (candidate as any)[key] = (data as any)[key];
    });

    return candidate;
  }



  class Modele implements TableModel<T> {
    constructor() {

    }

    get schema():SchemaDefinition<T>{return JSON.parse(JSON.stringify(schema.data))}

    async create(data: Partial<T>): Promise<T> {
      const table = await tableP
      const errors = schema.getErrors(data, table);

      if (errors.length > 0) {
        throw new Error(errors.join(" "));
      }
      const item = schema.buildItem(data);
      table.addItem(item)
      await saveDb();
      return item;
    }
    async createMany(datas: Partial<T>[]): Promise<T[]> {
      const table = await tableP
      const items = datas.map(data => {
        const errors = schema.getErrors(data, table);

        if (errors.length > 0) {
          throw new Error(errors.join(" "));
        }
        const item = schema.buildItem(data)
        table.addItem(item)
        return item as T
      })

      await saveDb();
      return items;
    }

    async findMany(query: Partial<T> = {}, options: QueryOptions = {}): Promise<T[]> {
      const table = await tableP
      const items = table.findByFilter(query) as T[];
      const populator = options?.populate
      if (populator != undefined) {

        return items.map((item) => item ? decorateItem(item, name, populator) : item) as T[];
      }
      return items;
    }

    async findOne(query: Partial<T>, options: QueryOptions = {}): Promise<T | undefined> {
      const table = await tableP
      const item = table.findByFilter(query, true) as T | undefined;
      const populator = options?.populate
      if (populator != undefined && item) {
        return decorateItem(item, name, populator) as T;
      }
      return item;
    }

    async findOneById(id: string, options: QueryOptions = {}): Promise<T | undefined> {
      const table = await tableP
      const item = table.getItemById(id) as T | undefined;
      const populator = options?.populate
      if (populator != undefined && item) {
        return decorateItem(item, name, populator) as T;
      }
      return item;
    }

    async updateOneById(id: string, data: Partial<T>): Promise<void> {
      const table = await tableP
      const index = table.getIndexById(id);
      const item = table.getItemByIndex(index) as T;

      const candidate = applyChanges(item, data);

      const errors = schema.getErrors(candidate, table);

      if (errors.length > 0) {

        throw new Error(errors.join(" "));
      }

      Object.keys(candidate).forEach((key) => {
        (item as any)[key] = (candidate as any)[key];
      });

      await saveDb();
    }

    async deleteMany(query: Partial<T>): Promise<void> {
      const table = await tableP
      const indexes = table.findIndexesByFilter(query) as number[];

      table.removeIndexes(indexes);

      await saveDb();
    }

    async deleteOne(item: T | string): Promise<void> {
      const table = await tableP
      const id = typeof item === "string" ? item : item.id;

      const index = table.getIndexById(id);

      table.removeIndex(index);

      await saveDb();
    }

    async deleteOneById(id: string): Promise<void> {
      const table = await tableP
      const index = table.getIndexById(id);

      table.removeIndex(index);

      await saveDb();
    }
  }

  const nm = new Modele();
  modeles[name] = schema
  return nm
}

const modeles: { [x: string]: Schema<any> } = {}

function decorateItem<T extends AnyObject>(item: T, tableName: string, populate?: PopulateOption): AnyObject {

  if (populate == undefined) {
    return { ...item }
  }
  const modele = modeles[tableName]

  if (!modele) { return { ...item } }
  const newItem = { ...item }
  const testeur = buildTestPopulator(populate)
  return modele.validator.populate(newItem, populate, testeur, decorateItem)



}