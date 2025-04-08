import { saveDb } from "./data.js";
import { createTable } from "./table.js";

export function model(name, schema) {
  if (!name) throw new Error("Vous devez fournir un nom de table.");
  if (!schema) throw new Error("Vous devez fournir les champs de la table.");

  const table = createTable(name, schema);

  
function applyChanges(item, data) {
  const candidate = { ...item };
  Object.keys(data).forEach((key) => {
    candidate[key] = data[key];
  });
  return candidate;
}

  class Modele {
    constructor(data) {
      const errors = schema.getErrors(data,table);
      if (errors.length > 0) {
        throw new Error(errors.join(" "));
      }
      schema.buildItem(data, this);
      schema.decorateItem(this);
    }

    async save() {
      if (!table.isExists(this._id)) {
        table.addItem(this);
      }

      return await saveDb();
    }

    static async create(data) {
      const item = new Modele(data);
      await item.save();
      return item;
    }

    static async find(data = {}) {
      const items = table.findByFilter(data);
      items.forEach((item) => schema.decorateItem(item));
      return items;
    }
    static async findOne(data) {
      const item = table.findByFilter(data, true);
      schema.decorateItem(item);
      return item;
    }
    static async findOneById(id) {
      let item = null;

      item = table.getItemById(id);
      schema.decorateItem(item);
      return item;
    }

    static async updateOneById(id, data) {
      const index = table.getIndexById( id);
      const item = table.getItemByIndex(index)

      const candidate = applyChanges(item, data);

      const errors = schema.getErrors(candidate,table);
      if (errors.length == 0) {
        throw new Error(errors.join(" "));
      } else {
        Object.keys(candidate).forEach((key)=>{item[key]=candidate[key]})
        
        await saveDb();
      }

    }
    static async deleteMany(data = {}) {
      const indexes = table.findIndexesByFilter(data);
      table.removeIndexes(indexes);
      await saveDb();
    }
    static async deleteOne(item) {
      const id = typeof item === "string" ? item : item._id;
      const index = table.getIndexById(id);
      table.removeIndex(index);
      await saveDb();
    }
    static async deleteOneById(id) {
      const index = table.getIndexById(id);
      table.removeIndex(index);
      await saveDb();
    }
  }

  return Modele;
}
