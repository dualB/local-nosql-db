import { saveDb } from "./data";
import { createTable, Table } from "./table";
import { Schema } from "./schema";

/**
 * Type générique d'un objet modèle
 */
export type ModelInstance = {
  _id: string;
  save(): Promise<void>;
  [key: string]: any;
};

/**
 * Type du constructeur retourné
 */
export type ModelStatic<T extends ModelInstance> = {
  new (data: Partial<T>): T;

  create(data: Partial<T>): Promise<T>;
  find(query?: Partial<T>): Promise<T[]>;
  findOne(query: Partial<T>): Promise<T | undefined>;
  findOneById(id: string): Promise<T | undefined>;

  updateOneById(id: string, data: Partial<T>): Promise<void>;

  deleteMany(query: Partial<T>): Promise<void>;
  deleteOne(item: T | string): Promise<void>;
  deleteOneById(id: string): Promise<void>;
};

/**
 * Factory principale
 */
export function model<T extends ModelInstance>(
  name: string,
  schema: Schema<T>
): ModelStatic<T> {
  if (!name) throw new Error("Vous devez fournir un nom de table.");
  if (!schema) throw new Error("Vous devez fournir les champs de la table.");

  const table: Table<T> = createTable<T>(name, schema as any);

  function applyChanges(item: T, data: Partial<T>): T {
    const candidate = { ...item };

    Object.keys(data).forEach((key) => {
      (candidate as any)[key] = (data as any)[key];
    });

    return candidate;
  }

  class Modele implements ModelInstance {
    _id!: string;

    constructor(data: Partial<T>) {
      const errors = schema.getErrors(data as T, table);

      if (errors.length > 0) {
        throw new Error(errors.join(" "));
      }

      schema.buildItem(data, this as T);
      schema.decorateItem(this as T);
    }

    async save(): Promise<void> {
      if (!table.isExists(this._id)) {
        table.addItem(this as T);
      }

      await saveDb();
    }

    static async create(data: Partial<T>): Promise<T> {
      const item = new Modele(data) as T;
      await item.save();
      return item;
    }

    static async find(query: Partial<T> = {}): Promise<T[]> {
      const items = table.findByFilter(query) as T[];

      items.forEach((item) => schema.decorateItem(item));

      return items;
    }

    static async findOne(query: Partial<T>): Promise<T | undefined> {
      const item = table.findByFilter(query, true) as T | undefined;

      schema.decorateItem(item);

      return item;
    }

    static async findOneById(id: string): Promise<T | undefined> {
      const item = table.getItemById(id) as T | undefined;

      schema.decorateItem(item);

      return item;
    }


    static async updateOneById(id: string, data: Partial<T>): Promise<void> {
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

    static async deleteMany(query: Partial<T>): Promise<void> {
      const indexes = table.findIndexesByFilter(query) as number[];

      table.removeIndexes(indexes);

      await saveDb();
    }

    static async deleteOne(item: T | string): Promise<void> {
      const id = typeof item === "string" ? item : item._id;

      const index = table.getIndexById(id);

      table.removeIndex(index);

      await saveDb();
    }

    static async deleteOneById(id: string): Promise<void> {
      const index = table.getIndexById(id);

      table.removeIndex(index);

      await saveDb();
    }
  }

  return Modele as unknown as ModelStatic<T>;
}