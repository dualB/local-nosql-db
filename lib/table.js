import { allTables as tables, fullDatas as loadedDatas } from "./data.js";

export function isTableExists(name) {
  return tables[name] != null;
}
export function createTable(name, schema) {
  if (tables[name]) throw new Error(`La table ${name} a déjà été créé`);
  const table = new Table(name, schema);
  tables[name] = table;
  return table;
}

export function getTable(name) {
  const table = tables[name];
  if (!table) {
    throw new Error(`La table '${name}' n'existe pas.`);
  }
  return table;
}

class Table {
  constructor(name, schema) {
    this.name = name;
    this.schema = schema;
    this.datas = loadedDatas[name] ? loadedDatas[name] : [];
  }

  addItem(item) {
    this.datas.push(item);
  }

  getItemByIndex(index) {
    if (index < 0 || index >= this.datas.length)
      throw new Error(
        `L'index ${index} demandé est invalide dans la table ${this.name}.`
      );
    return this.datas[index];
  }

  removeIndexes(indexes = []) {
    for (let i = indexes.length - 1; i >= 0; i--) {
      this.datas.splice(indexes[i], 1);
    }
  }
  removeIndex(index) {
    this.removeIndexes[index];
  }

  replaceByIndex(index, candidate) {
    this.datas.splice(index, 1, candidate);
  }

  isExists(id) {
    return this.datas.find((i) => i._id == id) != null;
  }

  findByFilter(data = {}, onlyOne = false) {
    const filtre = (item) => {
      return Object.keys(data).every((key) => {
        return item[key] === data[key];
      });
    };
    if (onlyOne) {
      return this.datas.find(filtre);
    } else {
      return this.datas.filter(filtre);
    }
  }

  findIndexesByFilter(data = {}, onlyOne = false) {
    const filtre = (item) => {
      return Object.keys(data).every((key) => {
        return item[key] === data[key];
      });
    };
    if (onlyOne) {
      return this.datas.indexOf(filtre);
    } else {
      const indexes = [];
      this.datas.forEach((item, index) => {
        if (filtre(item)) {
          indexes.push(index);
        }
      });
      return indexes;
    }
  }

  getIndexById(id) {
    const index = this.datas.findIndex((v) => v._id === id);
    if (index < 0)
      throw new Error(`La clé ${id} n'existe pas dans la table '${name}'.`);

    return index;
  }

  getItemById(id) {
    const item = this.datas.find((v) => v._id === id);
    return item;
  }

  hasDuplicates(key, data) {
  
    const isTheSame = (item) => {
      return item[key] === data[key];
    };
    return this.datas.some(isTheSame);
  }
  
  
  

  toObject() {
    const validator = this.schema.validator;
    return this.datas.map((item) => {
      const newItem = JSON.parse(JSON.stringify(item));
      validator.unpopulators.forEach((unpop) => unpop(newItem));
      return newItem;
    });
  }
}
