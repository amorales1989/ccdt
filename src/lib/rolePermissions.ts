/** Roles fijos del enum app_role, en el orden en que se muestran. Los roles propios de cada
 *  empresa (tabla company_roles) se agregan aparte; ver el hook useRoles. */
export const BUILTIN_ROLES = [
  'admin', 'director_general', 'director', 'vicedirector',
  'secretaria', 'secr.-calendario', 'lider', 'maestro',
  'conserje', 'colaborador', 'auxiliar_maestro', 'miembro',
] as const;

export const BUILTIN_ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', director_general: 'Director General', director: 'Director',
  vicedirector: 'Vicedirector', secretaria: 'Secretaria', 'secr.-calendario': 'Secr. Calendario',
  lider: 'Líder', maestro: 'Maestro', conserje: 'Conserje',
  colaborador: 'Colaborador', auxiliar_maestro: 'Auxiliar de maestro',
  miembro: 'Miembro (sin funciones)',
};

/** Los roles creados por la empresa siempre llevan este prefijo (lo pone el back). */
export const isCustomRole = (role: string) => role.startsWith('custom_');

export const DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  admin:             { puede_gestionar_mantenimiento: true,  puede_agregar_miembros: true,  puede_agregar_miembros_sin_depto: true,  menu_todos_miembros: true,  menu_lista_miembros: true,  menu_archivo: true,  menu_asistencia: false, menu_historial: true,  menu_promover: true,  menu_autorizaciones: true,  menu_estadisticas: true,  menu_informes: true,  menu_material: true,  menu_grupos: true, menu_departamentos: true,  menu_contabilidad: true,  menu_gestion_usuarios: true,  menu_configuracion: true,  menu_mantenimiento: true,  menu_notificaciones: true,  menu_registro_temas: true  },
  director_general:  { puede_gestionar_mantenimiento: false, puede_agregar_miembros: false, puede_agregar_miembros_sin_depto: false, menu_todos_miembros: false, menu_lista_miembros: true,  menu_archivo: true,  menu_asistencia: false, menu_historial: true,  menu_promover: true,  menu_autorizaciones: false, menu_estadisticas: true,  menu_informes: true,  menu_material: true,  menu_grupos: true, menu_departamentos: false, menu_contabilidad: false,  menu_gestion_usuarios: true,  menu_configuracion: false, menu_mantenimiento: true,  menu_notificaciones: false, menu_registro_temas: true  },
  director:          { puede_gestionar_mantenimiento: false, puede_agregar_miembros: true,  puede_agregar_miembros_sin_depto: false, menu_todos_miembros: false, menu_lista_miembros: true,  menu_archivo: false, menu_asistencia: true,  menu_historial: true,  menu_promover: true,  menu_autorizaciones: false, menu_estadisticas: true,  menu_informes: true,  menu_material: false, menu_grupos: true, menu_departamentos: false, menu_contabilidad: false,  menu_gestion_usuarios: true,  menu_configuracion: false, menu_mantenimiento: true,  menu_notificaciones: false, menu_registro_temas: true  },
  vicedirector:      { puede_gestionar_mantenimiento: false, puede_agregar_miembros: true,  puede_agregar_miembros_sin_depto: false, menu_todos_miembros: false, menu_lista_miembros: true,  menu_archivo: false, menu_asistencia: true,  menu_historial: true,  menu_promover: true,  menu_autorizaciones: false, menu_estadisticas: true,  menu_informes: true,  menu_material: false, menu_grupos: true, menu_departamentos: false, menu_contabilidad: false,  menu_gestion_usuarios: true,  menu_configuracion: false, menu_mantenimiento: true,  menu_notificaciones: false, menu_registro_temas: true  },
  secretaria:        { puede_gestionar_mantenimiento: false, puede_agregar_miembros: true,  puede_agregar_miembros_sin_depto: true,  menu_todos_miembros: true,  menu_lista_miembros: true,  menu_archivo: true,  menu_asistencia: false, menu_historial: true,  menu_promover: true,  menu_autorizaciones: true,  menu_estadisticas: true,  menu_informes: false, menu_material: true,  menu_grupos: true, menu_departamentos: true,  menu_contabilidad: false,  menu_gestion_usuarios: true,  menu_configuracion: true,  menu_mantenimiento: true,  menu_notificaciones: true,  menu_registro_temas: false },
  'secr.-calendario':{ puede_gestionar_mantenimiento: false, puede_agregar_miembros: false, puede_agregar_miembros_sin_depto: false, menu_todos_miembros: false, menu_lista_miembros: false, menu_archivo: false, menu_asistencia: false, menu_historial: false, menu_promover: false, menu_autorizaciones: false, menu_estadisticas: false, menu_informes: false, menu_material: false, menu_grupos: false, menu_departamentos: false, menu_contabilidad: false, menu_gestion_usuarios: false, menu_configuracion: false, menu_mantenimiento: true,  menu_notificaciones: false, menu_registro_temas: false },
  lider:             { puede_gestionar_mantenimiento: false, puede_agregar_miembros: false, puede_agregar_miembros_sin_depto: false, menu_todos_miembros: false, menu_lista_miembros: true,  menu_archivo: false, menu_asistencia: true,  menu_historial: true,  menu_promover: true,  menu_autorizaciones: true,  menu_estadisticas: false, menu_informes: false, menu_material: false, menu_grupos: true, menu_departamentos: false, menu_contabilidad: false,  menu_gestion_usuarios: false, menu_configuracion: false, menu_mantenimiento: true,  menu_notificaciones: false, menu_registro_temas: false },
  maestro:           { puede_gestionar_mantenimiento: false, puede_agregar_miembros: false, puede_agregar_miembros_sin_depto: false, menu_todos_miembros: false, menu_lista_miembros: true,  menu_archivo: false, menu_asistencia: true,  menu_historial: true,  menu_promover: false, menu_autorizaciones: false, menu_estadisticas: false, menu_informes: true,  menu_material: false, menu_grupos: true, menu_departamentos: false, menu_contabilidad: false, menu_gestion_usuarios: false, menu_configuracion: false, menu_mantenimiento: true,  menu_notificaciones: false, menu_registro_temas: true  },
  conserje:          { puede_gestionar_mantenimiento: true,  puede_agregar_miembros: false, puede_agregar_miembros_sin_depto: false, menu_todos_miembros: false, menu_lista_miembros: false, menu_archivo: false, menu_asistencia: false, menu_historial: false, menu_promover: false, menu_autorizaciones: false, menu_estadisticas: false, menu_informes: false, menu_material: false, menu_grupos: false, menu_departamentos: false, menu_contabilidad: false, menu_gestion_usuarios: false, menu_configuracion: false, menu_mantenimiento: true,  menu_notificaciones: false, menu_registro_temas: false },
  colaborador:       { puede_gestionar_mantenimiento: false, puede_agregar_miembros: false, puede_agregar_miembros_sin_depto: false, menu_todos_miembros: false, menu_lista_miembros: true,  menu_archivo: false, menu_asistencia: true,  menu_historial: true,  menu_promover: true,  menu_autorizaciones: false, menu_estadisticas: false, menu_informes: false, menu_material: false, menu_grupos: true, menu_departamentos: false, menu_contabilidad: false, menu_gestion_usuarios: false, menu_configuracion: false, menu_mantenimiento: true,  menu_notificaciones: false, menu_registro_temas: false },
  auxiliar_maestro:  { puede_gestionar_mantenimiento: false, puede_agregar_miembros: true,  puede_agregar_miembros_sin_depto: false, menu_todos_miembros: false, menu_lista_miembros: true,  menu_archivo: false, menu_asistencia: true,  menu_historial: true,  menu_promover: false, menu_autorizaciones: false, menu_estadisticas: false, menu_informes: true,  menu_material: false, menu_grupos: true, menu_departamentos: false, menu_contabilidad: false, menu_gestion_usuarios: false, menu_configuracion: false, menu_mantenimiento: true,  menu_notificaciones: false, menu_registro_temas: true  },
  // Solo asiste a la iglesia: conserva la cuenta pero no trabaja en ningún departamento.
  miembro:           { puede_gestionar_mantenimiento: false, puede_agregar_miembros: false, puede_agregar_miembros_sin_depto: false, menu_todos_miembros: false, menu_lista_miembros: false, menu_archivo: false, menu_asistencia: false, menu_historial: false, menu_promover: false, menu_autorizaciones: false, menu_estadisticas: false, menu_informes: false, menu_material: false, menu_grupos: false, menu_departamentos: false, menu_contabilidad: false, menu_gestion_usuarios: false, menu_configuracion: false, menu_mantenimiento: false, menu_notificaciones: false, menu_registro_temas: false },
};

export type SavedPermissions = Record<string, Record<string, boolean>>;

/** Roles del perfil: el array `roles` si viene, si no el `role` primario. */
export const rolesOf = (profile?: { role?: string | null; roles?: string[] | null } | null): string[] =>
  (Array.isArray(profile?.roles) && profile.roles.length > 0)
    ? profile.roles
    : ([profile?.role].filter(Boolean) as string[]);

/**
 * Resuelve un permiso contra lo guardado en `company.role_permissions`, con fallback
 * a DEFAULT_PERMISSIONS. Alcanza con que UNO de los roles del perfil lo tenga.
 */
export const hasPermission = (
  profile: { role?: string | null; roles?: string[] | null } | null | undefined,
  key: string,
  savedPerms?: SavedPermissions,
): boolean =>
  rolesOf(profile).some(r =>
    savedPerms?.[r] && key in savedPerms[r]
      ? savedPerms[r][key] === true
      : DEFAULT_PERMISSIONS[r]?.[key] === true
  );
