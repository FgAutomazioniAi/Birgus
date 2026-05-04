export const APP_ROUTES = {
  dashboard: "/",
  projects: "/",
  projectNew: "/projects/new",
  projectVersions: (id: string) => `/projects/${id}`,
  projectEdit: (id: string) => `/projects/edit/${id}`,
  clients: "/clients",
  clientNew: "/clients/new",
  clientEdit: (id: number | string) => `/clients/edit/${id}`,
  spedizioni: "/spedizioni",
  shipmentDetail: (id: string) => `/spedizioni/${id}`,
  // DDT_READER_FEATURE_START
  ddtReader: "/ddt-reader",
  // DDT_READER_FEATURE_END
  settings: "/settings",
  login: "/login",
} as const;
