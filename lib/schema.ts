import { ObjectId } from "bson";
import { isTableExists, getTable, Table } from "./table";

/**
 * Type générique d'un item manipulé
 */
export type AnyObject = Record<string, any>;

/**
 * Définition d’un champ de schéma
 */
export type FieldDefinition =
  | string
  | (new (value: any) => any)
  | {
      type: string | (new (value: any) => any);
      required?: boolean;
      unique?: boolean;
      default?: any | (() => any);
      ref?: string;
    };

/**
 * Structure complète du schéma
 */
export type SchemaDefinition = Record<string, FieldDefinition>;

/**
 * Validator interne
 */
interface FieldValidator {
  validators: Array<(data: AnyObject, table: Table<any>) => string | null>;
  build: (value: any) => any;
  getErrors: (data: AnyObject, table: Table<any>) => (string | null)[];
}

interface Validator {
  fields: Record<string, FieldValidator>;
  populators: Array<(data: AnyObject) => void>;
  unpopulators: Array<(data: AnyObject) => void>;
  defaultors: Array<(data: AnyObject) => void>;
  getErrors: (data: AnyObject, table: Table<any>) => string[];
}

/**
 * Classe principale Schema
 */
export class Schema<T extends AnyObject = AnyObject> {
  public data: SchemaDefinition;
  public validator: Validator;

  constructor(data: SchemaDefinition) {
    this.data = data;
    this.validator = buildValidator(data);
  }

  getErrors(data: T, table: Table<T>): string[] {
    return this.validator.getErrors(data, table);
  }

  buildItem(data: Partial<T>, target: T): void {
    target._id = new ObjectId().toString() as any;

    const validator = this.validator;
    const dataa = data ?? {};

    Object.keys(dataa).forEach((key) => {
      const value = (data as any)[key];
      target[key] = validator.fields[key].build(value);
    });

    validator.defaultors.forEach((defaulter) => {
      defaulter(target);
    });
  }

  decorateItem(item: T | undefined): void {
    if (item) {
      this.validator.populators.forEach((populator) => populator(item));
    }
  }
}

/**
 * Construction du validator
 */
function buildValidator(structure: SchemaDefinition): Validator {
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
  };

  Object.keys(structure).forEach((key) => {
    const item = structure[key];

    const fieldValidator: FieldValidator = {
      validators: [],
      build: () => {},
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
                : item.default;
          }
        });
      }

      if (item.ref) {
        validator.populators.push((data) => {
          if (
            data[key] &&
            typeof data[key] === "string" &&
            isTableExists(item.ref!)
          ) {
            const popItem = getTable(item.ref!).getItemById(data[key]);
            if (popItem) {
              data[key] = popItem;
            }
          }
        });

        validator.unpopulators.push((data) => {
          if (data[key] && typeof data[key] === "object") {
            const _id = data[key]._id;
            if (_id) {
              data[key] = _id;
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
            data?._id ? data._id : data
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