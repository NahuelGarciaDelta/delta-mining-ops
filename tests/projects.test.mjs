import test from "node:test";
import assert from "node:assert/strict";
import {normalizeProjectName,collectProjects,projectMatches} from "../src/shared/projects.js";

test("normaliza aliases conocidos sin absorber proyectos futuros",()=>{
  assert.equal(normalizeProjectName("JM"),"JOSE MARIA");
  assert.equal(normalizeProjectName("FDS"),"FILO DEL SOL");
  assert.equal(normalizeProjectName("Filo Norte"),"FILO NORTE");
  assert.equal(normalizeProjectName("Proyecto Andino"),"PROYECTO ANDINO");
});

test("descubre proyectos nuevos desde ROP02 ROP05 y RMA15",()=>{
  const found=collectProjects(
    [{proyecto:"JM"},{proyecto:"Proyecto Andino"}],
    [{lugar:"Filo Norte"}],
    [{Proyecto:"El Zorro"}],
  );
  assert.deepEqual(found,["EL ZORRO","FILO NORTE","JOSE MARIA","PROYECTO ANDINO"]);
  assert.equal(projectMatches("jm","José María"),true);
});
