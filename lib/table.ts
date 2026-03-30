import {
  allTables as tables,
  fullDatas as loadedDatas,
  Persistable,
  Table as ITable,
} from "./data";

/**
 * Type générique d'un item stocké
 */
export interface BaseItem extends Persistable {
  _id?: string;
  [key: string]: any;
}

/**
 * Schéma minimal attendu
 */
export interface TableSchema<T extends BaseItem> {
  validator: {
    unpopulators: Array<(item: T) => void>;
  };
}

/**
 * API publique
 */
export function isTableExists(name: string): boolean {
  return tables[name] != null;
}

export function createTable<T extends BaseItem>(
  name: string,
  schema: TableSchema<T>
): Table<T> {
  if (tables[name]) {
    throw new Error(`La table ${name} a déjà été créée`);
  }

  const table = new Table<T>(name, schema);
  tables[name] = table as unknown as ITable;

  return table;
}

export function getTable<T extends BaseItem>(name: string): Table<T> {
  const table = tables[name];
  if (!table) {
    throw new Error(`La table '${name}' n'existe pas.`);
  }
  return table as Table<T>;
}

/**
 * Implémentation Table
 */
export class Table<T extends BaseItem> {
  public name: string;
  public schema: TableSchema<T>;
  public datas: T[];

  constructor(name: string, schema: TableSchema<T>) {
    this.name = name;
    this.schema = schema;
    this.datas = (loadedDatas[name] as T[]) ?? [];
  }

  addItem(item: T): void {
    this.datas.push(item);
  }

  getItemByIndex(index: number): T {
    if (index < 0 || index >= this.datas.length) {
      throw new Error(
        `L'index ${index} demandé est invalide dans la table ${this.name}.`
      );
    }
    return this.datas[index];
  }

  removeIndexes(indexes: number[] = []): void {
    for (let i = indexes.length - 1; i >= 0; i--) {
      this.datas.splice(indexes[i], 1);
    }
  }

  removeIndex(index: number): void {
    this.removeIndexes([index]);
  }

  isExists(id: string): boolean {
    return this.datas.some((i) => i._id == id);
  }

  private buildFiltre(query: Partial<T>) {
    return (item: T): boolean => {
      return Object.keys(query).every((key) => {
        const k = key as keyof T;

        return (
          item[k] === query[k] ||
          ((item[k] as any)?._id === query[k])
        );
      });
    };
  }

  findByFilter(query: Partial<T> = {}, onlyOne = false): T | T[] | undefined {
    const filtre = this.buildFiltre(query);

    if (onlyOne) {
      return this.datas.find(filtre);
    } else {
      return this.datas.filter(filtre);
    }
  }

  /**
   * FIX IMPORTANT ici
   */
  findIndexesByFilter(
    query: Partial<T> = {},
    onlyOne = false
  ): number | number[] {
    const filtre = this.buildFiltre(query);

    if (onlyOne) {
      return this.datas.findIndex(filtre); // <-- FIX
    } else {
      const indexes: number[] = [];

      this.datas.forEach((item, index) => {
        if (filtre(item)) {
          indexes.push(index);
        }
      });

      return indexes;
    }
  }

  getIndexById(id: string): number {
    const index = this.datas.findIndex((v) => v._id === id);

    if (index < 0) {
      throw new Error(
        `La clé ${id} n'existe pas dans la table '${this.name}'.`
      );
    }

    return index;
  }

  getItemById(id: string): T | undefined {
    return this.datas.find((v) => v._id === id);
  }

  hasDuplicates(key: keyof T, data: T): boolean {
    return this.datas.some((item) => item[key] === data[key]);
  }

  toObject(): T[] {
    const validator = this.schema.validator;

    return this.datas.map((item) => {
      const newItem: T = JSON.parse(JSON.stringify(item));

      validator.unpopulators.forEach((unpop) => unpop(newItem));

      return newItem;
    });
  }
}