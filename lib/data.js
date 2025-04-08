import fs from "fs";

export const allTables = {};
export const fullDatas = {};

function formatForFile() {
  const dbContent = {};
  Object.keys(allTables).forEach((key) => {
    dbContent[key] = allTables[key].toObject()
   
  });

  const txt = JSON.stringify(dbContent, null, 2);
  return txt;
}

export let saveDb = () => {
  console.warn(
    "Aucune sauvegarde effectué. La base de donnée ne sera qu'en mémoire."
  );
};

let loadDb = () => {
  console.warn("La base de donnée ne sera qu'en mémoire.");
};

export function connect(uri, startFromScratch = false) {
  loadDb = () => {
    try {
      if (!fs.existsSync(uri)) return;
      const data = fs.readFileSync(uri, { encoding: "utf8" });
      const real = JSON.parse(data);
      
      Object.keys(real).forEach((key) => {
        real[key].forEach((item)=>{item.save = async ()=>{await saveDb()}})
        fullDatas[key] = real[key];
      });
    } catch (err) {
      console.error(err);
    }
  };

  saveDb = () => {
    try {
      fs.writeFileSync(uri, formatForFile());
    } catch (err) {
      console.error(err);
    }
  };

  if (!startFromScratch) {
    loadDb();
  }
}

export default {   connect };
