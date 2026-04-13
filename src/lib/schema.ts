import { ObjectId } from "bson";
import { isTableExists, getTable, Table, BaseItem } from "./table";

/**
 * Type générique d'un item manipulé
 */
export type AnyObject = BaseItem

/**
 * Définition d’un champ de schéma
 */

type Constructor<T = any> = new (value: any) => T;

type BaseField = {
  required?: boolean;
  unique?: boolean;
  
};

type RefField = BaseField & {
  type: 'id' | 'objectid';
  ref: string;
  default?: string | (() => string);
};

type StringRefField = BaseField & {
  type:  'string' | Constructor<string>;
  default?: string | (() => string);
};
type NumberRefField = BaseField & {
  type:  'number' | Constructor<number>;
  default?: number | (() => number);
};
type BooleanRefField = BaseField & {
  type:  'boolean' | Constructor<boolean>;
  default?: boolean | (() => boolean);
};
/*type DateRefField = BaseField<Date> & {
  type:  'date' | Constructor<Date>;
};*/

export type FieldDefinition =
  | string
  | Constructor
  | RefField
  | StringRefField
  | NumberRefField
  | BooleanRefField;
  

/**
 * Structure complète du schéma
 */
export type SchemaDefinition<T> = Record<keyof T, FieldDefinition>;

/**
 * Validator interne
 */
interface FieldValidator {
  validators: Array<(data: Partial<AnyObject>, table: Table<any>) => string | null>;
  build: (value: any) => any;
  getErrors: (data: Partial<AnyObject>, table: Table<any>) => (string | null)[];
}

interface Validator {
  fields: Record<string, FieldValidator>;
  populators: Array<(data: AnyObject, populator: PopulateOption, test: (key: string) => boolean, afterPop: (poppedItem: AnyObject, fromTable: string, option?: PopulateOption) => AnyObject) => AnyObject>;
  unpopulators: Array<(data: AnyObject) => void>;
  defaultors: Array<(data: AnyObject) => void>;
  getErrors: (data: Partial<AnyObject>, table: Table<any>) => string[];
  populate: (data: AnyObject, populator: PopulateOption, testeur: (key: string) => boolean, afterPop: (poppedItem: AnyObject, fromTable: string, option?: PopulateOption) => AnyObject) => AnyObject
}

export type PopulateOption = true | string | string[] | { [x: string]: PopulateOption }

export function buildTestPopulator(option: PopulateOption = {}): (field: string) => boolean {

  if (!option) { return () => false }
  if (option == true) {
    return (field: string) => true
  }
  if (typeof option === 'string') {
    return (field: string) => option == field
  }
  if (Array.isArray(option)) {
    return (field: string) => option.some(name => name == field)
  }
  else {
    return (field: string) => option[field] != undefined
  }

}


/**
 * Classe principale Schema
 */
export class Schema<T extends AnyObject> {
  public data: SchemaDefinition<T>;
  public validator: Validator;

  constructor(data: SchemaDefinition<Omit<T, "id">>) {
    this.data = { ...data, "id": { type: 'id', unique: true, required: true } } as unknown as SchemaDefinition<T>
    this.validator = buildValidator(data);
  }

  getErrors(data: Partial<T>, table: Table<T>): string[] {
    return this.validator.getErrors(data, table);
  }

  buildItem(data: Partial<T>): T {
    const target = {} as any
    target.id = new ObjectId().toString() as any;

    const validator = this.validator;
    if (data) {
      const keys = Object.keys(data)

      keys.forEach(k => {
        const value = data[k]
        target[k] = validator.fields[k].build(value);
      });
    }
    validator.defaultors.forEach((defaulter) => {
      defaulter(target);
    });
    return target as T
  }

}

/**
 * Construction du validator
 */
function buildValidator<T extends AnyObject>(structure: SchemaDefinition<T>): Validator {
  const validator: Validator = {
    fields: {},
    populators: [],
    unpopulators: [],
    defaultors: [],
    getErrors(data, table) {
      return Object.keys(this.fields)
        .map((key) => this.fields[key].getErrors(data, table))
        .flat()
        .filter((e): e is string => e != null);
    },
    populate(item, pop, testeur, afterPop) {
      return this.populators.reduce((previous, populator) => populator(previous, pop, testeur, afterPop), item);
    }
  };

  Object.keys(structure).forEach((key) => {
    const item = structure[key];

    const fieldValidator: FieldValidator = {
      validators: [],
      build: () => { },
      getErrors(data, table) {
        if (!table) {
          throw new Error(
            "La table doit être fournie pour tester les erreurs."
          );
        }
        return this.validators
          .map((v) => v(data, table))
          .filter((e): e is string => e != null);
      },
    };

    validator.fields[key] = fieldValidator;

    const type = typeof item === "object" ? item.type : item;
    fieldValidator.build = builder(type, key);

    if (typeof item === "object") {
      if (item.required === true) {
        fieldValidator.validators.push((data) => {
          if (!data || data[key] == null) {
            return `Le champ '${key}' est requis.`;
          }
          return null;
        });
      }

      if (item.unique) {
        fieldValidator.validators.push((data, table) =>
          table.hasDuplicates(key as any, data)
            ? `La valeur '${data[key]}' du champ ${key} est déjà présente dans la table.`
            : null
        );
      }

      if (item.default !== undefined) {
        validator.defaultors.push((data) => {
          if (!data[key]) {
            data[key] =
              typeof item.default === "function"
                ? item.default()
                : item.default as any;
          }
        });
      }

      if ((item.type=='id' || item.type=='objectid') && item.ref) {
        validator.populators.push((data, pop: any | undefined, test, afterPop) => {

          if (test(key) && data[key] && typeof data[key] === "string" && isTableExists(item.ref!)) {
            const name = item.ref
            const table = name ? getTable(name) : undefined
            if (table && name) {
              const popItem = table.getItemById(data[key]);
              if (popItem) {
              
                data[key] = afterPop(popItem, name, pop==true?true: pop[key] || undefined)
              }
            }
          }
          return data
        });

        validator.unpopulators.push((data) => {
          if (data[key] && typeof data[key] === "object") {
            const id = data[key].id;
            if (id) {
              data[key] = id;
            }
          }
        });
      }
    }
  });

  return validator;
}

/**
 * Builder de type
 */
function builder(item: any, key: string): (data: any) => any {
  if (item == null) {
    throw new Error(`Le type du champ '${key}' n'est pas défini.`);
  }

  if (typeof item === "function") {
    return (data: any) => {
      if (item === ObjectId) {
        return new item(data);
      }
      return item(data);
    };
  }

  if (typeof item === "string") {
    switch (item.toLowerCase()) {
      case "string":
        return (data: any) =>
          typeof data === "string" ? data : String(data);

      case "number":
        return (data: any) => Number(data);

      case "date":
        return (data: any) => new Date(data);

      case "boolean":
        return (data: any) => Boolean(data);

      case "id":
      case "objectid":
        return (data: any) =>
          ObjectId.createFromHexString(
            data?.id ? data.id : data
          ).toString();

      default:
        throw new Error(
          `Type '${item}' non supporté pour le champ '${key}'.`
        );
    }
  }

  throw new Error(
    `Le type du champ '${key}' n'est pas défini ou mal défini.`
  );
}