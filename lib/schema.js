import { ObjectId } from "bson";
import { isTableExists,getTable } from "./table.js";
export class Schema {
  constructor(data) {
    this.data = data;

    this.validator = buildValidator(data);
  }
  getErrors(data, table) {
    return this.validator.getErrors(data, table);
  }

  buildItem(data, target) {
    target._id = new ObjectId().toString();
    const validator = this.validator;

    const dataa = data ? data : {};

    Object.keys(dataa).forEach((key) => {
      const value = data[key];
      target[key] = validator.fields[key].build(value);
    });
    validator.defaultors.forEach((defaulter) => {
      defaulter(target);
    });
    return;
  }

  decorateItem(item) {
    if (item) {
      const valid = this.validator;
      valid.populators.forEach((populator) => populator(item));
    }
  }
}

function buildValidator(structure) {
  const validator = {
    fields: {},
    populators: [],
    unpopulators: [],
    defaultors: [],
    getErrors(data,table) {
      return Object.keys(this.fields)
        .map((key) => this.fields[key].getErrors(data,table))
        .flat()
        .filter((e) => e != null);
    },
  };
  Object.keys(structure).forEach((key) => {
    const item = structure[key];
    const valid = {
      validators: [],
      getErrors(data,table) {
        if(table==null)throw new Error('La table doit être fourni pour tester les erreurs.')
        return this.validators.map((v) => v(data,table)).filter((e) => e != null);
      },
    };
    validator.fields[key] = valid;

    valid.build = builder(typeof item === "object" ? item.type : item, key);

    if (typeof item === "object") {
      if (item.required == true) {
        valid.validators.push((data) => {
          if (!data || data[key] == null) {
            return `Le champ '${key}' est requis.`;
          }
          return null;
        });
      }
      if (item.unique) {
        valid.validators.push((data, table) =>
          table.hasDuplicates(key, data)
            ? `La valeur '${data[key]}' du champ ${key} est déjà présent dans la table.`
            : null
        );
      }
      if (item.default) {
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
            isTableExists(item.ref)
          ) {
            const popItem = getTable(item.ref).getItemById( data[key]);
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

function builder(item, key) {
  if (item == null)
    throw new Error(`Le type du champ '${key}' n'est pas défini.`);
  if (typeof item === "function") {
    return (data) => {
      if(item===ObjectId){
        return new item(data)
      }
      return item(data);
    }; //directement un type String, Number, etc, Date
  } else if (typeof item === "string") {
    switch (item.toLowerCase()) {
      case "string":
        return (data) => {
          if (typeof data == "string") {
            return data;
          }
          return String(data);
        };

      case "number":
        return (data) => {
          return Number(data);
        };

      case "date":
        return (data) => {
          return Date(data);
        };

      case "boolean":
        return (data) => {
          return Boolean(data);
        };

      case "id":
      case "objectid":
        return (data) => {
          return ObjectId.createFromHexString(
            data._id ? data._id : data
          ).toString();
        };
    }
  } else {
    throw new Error(
      `Le type du champ '${key}' n'est pas défini ou mal défini.`
    );
  }
}
