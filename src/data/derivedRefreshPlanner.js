// Keep costly normalization scoped to the datasets it actually depends on.
// Source identity changes when App receives a new snapshot; a project change
// also invalidates all project-filtered derived collections.
export function planDerivedRefresh(previousSources, sources, previousProject, project) {
  const previous = previousSources || null;
  const current = sources || {};
  const changed = key => !previous || previous[key] !== current[key];
  const projectChanged = !previous || previousProject !== project;

  const rosterChanged = changed("lista_equipos");
  const rop05Changed = changed("rop05");
  const rop02Changed = ["rop02_fs", "rop02_jm", "rop02_filosur", "rop02_zorro"].some(changed);
  const insumosChanged = changed("insumos");
  const rma15Changed = changed("rma15_fs") || changed("rma15_jm");

  return {
    // ROP05 output also resolves equipment aliases from the master roster.
    rop05: projectChanged || rop05Changed || rosterChanged,
    // The canonical name map also includes ROP05 supervisor names.
    rop02: projectChanged || rop02Changed || rop05Changed || rosterChanged,
    insumos: insumosChanged,
    rma15: projectChanged || rma15Changed || insumosChanged || rosterChanged,
    listaEquipos: rosterChanged,
  };
}
