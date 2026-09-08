import packageMetadata from "../../package.json";

const configuredVersion = process.env.APP_VERSION?.trim();

export const APP_VERSION = configuredVersion || packageMetadata.version;
